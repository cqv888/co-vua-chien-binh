// ===== Three.js 3D board & duel =====
const V3 = (() => {
  if (typeof THREE === 'undefined') return null;
  const COL = { wFill: 0xf6e9cc, bFill: 0x3b3346, wTrim: 0xf2b636, bTrim: 0xe4483a, sqL: 0xf3dcae, sqD: 0xb7794b, edge: 0x5a3620 };
  const srgb = c => new THREE.Color(c).convertSRGBToLinear();
  // Each set: colours + material feel + shape. Inspired by 3D reference art (glass set, neon set, toy set, gold/silver set, low-poly set).
  const SETS = {
    classic: { wFill: 0xf6e9cc, bFill: 0x3b3346, wTrim: 0xf2b636, bTrim: 0xe4483a, wLine: '#8a6a2c', bLine: '#120d1a' },
    royal: { wFill: 0xf7d36a, bFill: 0xb8302a, wTrim: 0xffffff, bTrim: 0xffd166, wLine: '#8a5a08', bLine: '#5a0f0a' },
    candy: { wFill: 0xff8fc7, bFill: 0x3fc9e8, wTrim: 0xffffff, bTrim: 0xfff6a3, wLine: '#a3336f', bLine: '#0f6c85', fill: { roughness: .18, metalness: .05 } },
    wood: { wFill: 0xe3b77a, bFill: 0x5b3a1e, wTrim: 0x7a4a2a, bTrim: 0xd9a066, wLine: '#7a4a2a', bLine: '#2a1508', fill: { roughness: .7, metalness: 0 } },
    glass: { wFill: 0xd8f4ff, bFill: 0x2a1f4a, wTrim: 0xffffff, bTrim: 0x9fd8ff, wLine: '#4a7c9a', bLine: '#0a0620', fill: { roughness: .05, metalness: .1, transparent: true, opacity: .72 }, trim: { roughness: .1, metalness: .3, transparent: true, opacity: .9 } },
    neon: { wFill: 0x14f0ff, bFill: 0xff3fd6, wTrim: 0xffffff, bTrim: 0xffffff, wLine: '#046b75', bLine: '#7a0a60', fill: { roughness: .35, metalness: .1, emissive: true, emissiveIntensity: .55 }, trim: { roughness: .2, metalness: .2, emissive: true, emissiveIntensity: .8 } },
    toy: { wFill: 0xffd23f, bFill: 0x3a7bff, wTrim: 0xff5a5f, bTrim: 0xffffff, wLine: '#9a6a00', bLine: '#0f2f7a', fill: { roughness: .55, metalness: 0 }, shape: 'chunky' },
    metal: { wFill: 0xf5c542, bFill: 0xc9ced6, wTrim: 0xfff2b0, bTrim: 0x5a6270, wLine: '#8a5a08', bLine: '#3a404a', fill: { roughness: .22, metalness: .95 }, trim: { roughness: .3, metalness: .9 } },
    crystal: { wFill: 0xb388ff, bFill: 0x1de9b6, wTrim: 0xffffff, bTrim: 0x0b6e5a, wLine: '#4a2a9a', bLine: '#044a3a', fill: { roughness: .3, metalness: .25, flatShading: true }, shape: 'lowpoly' }
  };
  let curSet = 'classic';
  const PM = {};
  const matCache = {};
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: srgb(color), roughness: .38, metalness: .08 }, opts || {}));
    return matCache[key];
  }
  const ease = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const clamp01 = t => Math.max(0, Math.min(1, t));

  // ---- piece geometry ----
  const geoCache = {};
  const shapeOf = () => (SETS[curSet] && SETS[curSet].shape) || 'staunton';
  const segsOf = () => shapeOf() === 'lowpoly' ? 7 : 40;
  function lathe(pts, segs) { return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), segs || segsOf()); }
  function base() { return [[0, 0], [.36, 0], [.39, .05], [.36, .1], [.3, .14]]; }
  function sphereArc(r, cy, n) { const out = []; for (let i = 1; i < n; i++) { const a = Math.PI * i / n; out.push([r * Math.sin(a), cy - r * Math.cos(a)]); } return out; }
  function profile(t) {
    switch (t) {
      case 'P': return base().concat([[.2, .2], [.15, .45], [.22, .5], [.22, .54], [.12, .58]], sphereArc(.19, .78, 12), [[0, .97]]);
      case 'R': return [[0, 0], [.38, 0], [.41, .05], [.38, .1], [.28, .16], [.24, .7], [.32, .76], [.32, 1.02], [.24, 1.02], [.24, .9], [0, .9]];
      case 'B': return base().concat([[.22, .2], [.18, .5], [.26, .55], [.26, .6], [.16, .65], [.22, .8], [.2, 1.02], [.12, 1.2], [.07, 1.22]], sphereArc(.07, 1.28, 8), [[0, 1.35]]);
      case 'Q': return base().concat([[.24, .2], [.19, .6], [.28, .66], [.28, .7], [.2, .75], [.24, .95], [.3, 1.15], [.34, 1.3], [.26, 1.3], [.18, 1.24], [.1, 1.3]], sphereArc(.08, 1.38, 8), [[0, 1.46]]);
      case 'K': return base().concat([[.24, .2], [.19, .6], [.28, .66], [.28, .7], [.2, .75], [.24, .95], [.3, 1.18], [.32, 1.32], [.22, 1.36], [.1, 1.36], [0, 1.36]]);
    }
  }
  // "toy" shape: fat, rounded, short - like children's plastic pieces
  function chunkyProfile(t) {
    const b = [[0, 0], [.4, 0], [.43, .06], [.4, .14], [.34, .18]];
    switch (t) {
      case 'P': return b.concat([[.3, .22], [.26, .42], [.3, .5]], sphereArc(.27, .78, 14), [[0, 1.05]]);
      case 'R': return b.concat([[.32, .22], [.3, .7], [.38, .76], [.38, 1.0], [.3, 1.0], [.3, .9], [0, .9]]);
      case 'B': return b.concat([[.3, .22], [.26, .5], [.34, .58], [.3, .62]], sphereArc(.24, .92, 14), [[.08, 1.2], [0, 1.28]]);
      case 'Q': return b.concat([[.32, .22], [.26, .6], [.36, .7], [.32, .78]], sphereArc(.3, 1.1, 14), [[0, 1.46]]);
      case 'K': return b.concat([[.32, .22], [.26, .6], [.36, .7], [.32, .8], [.34, 1.1], [.36, 1.22], [.2, 1.3], [0, 1.3]]);
    }
  }
  function knightHead() {
    const s = new THREE.Shape();
    const pts = [[-.22, 0], [.2, 0], [.22, .3], [.14, .42], [.3, .48], [.5, .52], [.54, .62], [.48, .7], [.3, .8], [.22, .86], [.16, 1.0], [.1, 1.12], [.02, .98], [-.06, 1.1], [-.12, .96], [-.2, .8], [-.26, .5], [-.26, .2]];
    s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
    const chunky = shapeOf() === 'chunky', low = shapeOf() === 'lowpoly';
    const g = new THREE.ExtrudeGeometry(s, { depth: chunky ? .34 : .26, bevelEnabled: true, bevelThickness: low ? .02 : .05, bevelSize: low ? .02 : .05, bevelSegments: low ? 1 : 4 });
    g.scale(chunky ? 1.0 : .92, chunky ? .95 : .92, 1); g.translate(0, .28, chunky ? -.17 : -.13); return g;
  }
  function geo(t) {
    const key = shapeOf() + t;
    if (geoCache[key]) return geoCache[key];
    const g = {};
    const chunky = shapeOf() === 'chunky';
    if (t === 'N') { g.body = lathe((chunky ? [[0, 0], [.4, 0], [.43, .06], [.4, .14], [.34, .18], [.3, .3], [0, .3]] : base().concat([[.24, .2], [.2, .3], [0, .3]]))); g.head = knightHead(); }
    else g.body = lathe(chunky ? chunkyProfile(t) : profile(t));
    geoCache[key] = g; return g;
  }
  function buildMaterials() {
    const s = SETS[curSet] || SETS.classic;
    const mk = (color, base, extra) => {
      const o = Object.assign({ color: srgb(color) }, base);
      if (extra) { const e = Object.assign({}, extra); if (e.emissive === true) { e.emissive = srgb(color); } Object.assign(o, e); }
      return new THREE.MeshStandardMaterial(o);
    };
    Object.values(PM).forEach(m => m && m.dispose && m.dispose());
    PM.wFill = mk(s.wFill, { roughness: .38, metalness: .08 }, s.fill); PM.bFill = mk(s.bFill, { roughness: .38, metalness: .08 }, s.fill);
    PM.wTrim = mk(s.wTrim, { roughness: .3, metalness: .4 }, s.trim); PM.bTrim = mk(s.bTrim, { roughness: .3, metalness: .4 }, s.trim);
  }
  function makePiece(p, facing) {
    const col = p[0], t = p[1], g = geo(t);
    if (!PM.wFill) buildMaterials();
    const chunky = shapeOf() === 'chunky', low = shapeOf() === 'lowpoly';
    const fill = col === 'w' ? PM.wFill : PM.bFill, trim = col === 'w' ? PM.wTrim : PM.bTrim;
    const grp = new THREE.Group();
    const add = (geom, m) => { const mesh = new THREE.Mesh(geom, m); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); return mesh; };
    add(g.body, fill);
    if (t === 'N') { const h = add(g.head, fill); const eye = add(new THREE.SphereGeometry(chunky ? .045 : .03, 8, 8), mat(0x111111)); eye.position.set(.3, .72, chunky ? .21 : .17); if (chunky) { const eye2 = add(new THREE.SphereGeometry(.045, 8, 8), mat(0x111111)); eye2.position.set(.3, .72, -.21); } }
    // collar ring (team color)
    const ringY = { P: .17, R: .17, N: .17, B: .17, Q: .17, K: .17 }[t];
    const ring = add(new THREE.TorusGeometry(chunky ? .37 : .33, chunky ? .035 : .025, 8, low ? 7 : 40), trim); ring.rotation.x = Math.PI / 2; ring.position.y = ringY + (chunky ? .03 : 0);
    if (t === 'R') { for (let i = 0; i < 4; i++) { const m = add(new THREE.BoxGeometry(.12, .12, .1), fill); const a = i * Math.PI / 2; m.position.set(Math.cos(a) * .27, 1.07, Math.sin(a) * .27); m.rotation.y = -a; } }
    if (t === 'Q') { for (let i = 0; i < 6; i++) { const m = add(new THREE.SphereGeometry(.045, 10, 10), trim); const a = i * Math.PI / 3; m.position.set(Math.cos(a) * .3, 1.34, Math.sin(a) * .3); } }
    if (t === 'K') { const c1 = add(new THREE.BoxGeometry(.07, .3, .07), trim); c1.position.y = chunky ? 1.44 : 1.5; const c2 = add(new THREE.BoxGeometry(.2, .07, .07), trim); c2.position.y = chunky ? 1.47 : 1.53; }
    if (t === 'B' && !chunky) { const slit = add(new THREE.BoxGeometry(.03, .16, .3), mat(col === 'w' ? 0xb08d4a : 0x120d1a)); slit.position.set(0, 1.05, .12); slit.rotation.x = .5; }
    if (t === 'Q' && chunky) { for (let i = 0; i < 5; i++) { const m = add(new THREE.ConeGeometry(.07, .16, 6), trim); const a = i * Math.PI * 2 / 5; m.position.set(Math.cos(a) * .22, 1.3, Math.sin(a) * .22); } }
    if (t === 'N') grp.rotation.y = facing === undefined ? (col === 'w' ? Math.PI / 2 : -Math.PI / 2) : (facing > 0 ? 0 : Math.PI);
    grp.userData.type = p;
    return grp;
  }

  // ---- generic scene setup ----
  function makeRenderer(w, h) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(w, h);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding;
    return r;
  }
  function lights(scene, size) {
    scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a2a4a, .9));
    const d = new THREE.DirectionalLight(0xffffff, 1.1); d.position.set(4, 10, 5); d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048); const s = size || 6; Object.assign(d.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 30 }); d.shadow.bias = -.0005;
    scene.add(d);
    const f = new THREE.DirectionalLight(0xc9b6ff, .35); f.position.set(-5, 6, -4); scene.add(f);
    return d;
  }
  function tweens() {
    const list = [];
    return {
      add(dur, fn, done) { list.push({ t0: performance.now(), dur, fn, done }); },
      step(now) { for (let i = list.length - 1; i >= 0; i--) { const tw = list[i]; const k = clamp01((now - tw.t0) / tw.dur); tw.fn(k); if (k >= 1) { list.splice(i, 1); tw.done && tw.done(); } } },
      get active() { return list.length > 0; }
    };
  }

  // ---- board view ----
  function buildBoard(stage, opts) {
    opts = opts || {};
    stage.innerHTML = '';
    const W0 = stage.clientWidth || 500, H0 = stage.clientHeight || W0;
    const renderer = makeRenderer(W0, H0);
    renderer.domElement.className = 'gl';
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W0 / H0, .1, 100);
    lights(scene, 7);
    // table / surrounding space
    const table = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: srgb(0x2a2140), roughness: .95 })); table.rotation.x = -Math.PI / 2; table.position.y = -.35; table.receiveShadow = true; scene.add(table);
    const halo = new THREE.Mesh(new THREE.RingGeometry(4.6, 7.5, 64), new THREE.MeshBasicMaterial({ color: srgb(0x6a4f9a), transparent: true, opacity: .25 })); halo.rotation.x = -Math.PI / 2; halo.position.y = -.34; scene.add(halo);
    // board
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9, .3, 9), mat(COL.edge, { roughness: .6 })); frame.position.y = -.19; frame.receiveShadow = true; scene.add(frame);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(8.3, .3, 8.3), mat(0x3a2010, { roughness: .6 })); trim.position.y = -.17; scene.add(trim);
    const squares = [], marks = {};
    const mkMark = (geom, color, op, y) => { const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: srgb(color), transparent: true, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.visible = false; return m; };
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const sq = new THREE.Mesh(new THREE.BoxGeometry(1, .12, 1), mat((r + c) % 2 ? COL.sqD : COL.sqL, { roughness: .55 }));
      sq.position.set(c - 3.5, -.06, r - 3.5); sq.receiveShadow = true; sq.userData = { r, c }; scene.add(sq); squares.push(sq);
      const g = new THREE.Group(); g.position.set(c - 3.5, 0, r - 3.5); scene.add(g);
      const m = {
        last: mkMark(new THREE.PlaneGeometry(.98, .98), 0xf2b636, .5, .003),
        sel: mkMark(new THREE.PlaneGeometry(.98, .98), 0x3f8ef5, .6, .004),
        check: mkMark(new THREE.PlaneGeometry(.98, .98), 0xe4483a, .65, .005),
        move: mkMark(new THREE.CircleGeometry(.17, 24), 0x2e9a55, .85, .006),
        cap: mkMark(new THREE.RingGeometry(.36, .45, 40), 0xe4483a, .9, .006)
      };
      Object.values(m).forEach(x => g.add(x)); marks[r * 8 + c] = m;
    }
    // coordinate labels via canvas sprites (small)
    function label(txt, x, z) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const cx = cv.getContext('2d');
      cx.font = 'bold 40px Nunito, sans-serif'; cx.fillStyle = '#e9d5a8'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, 32, 34);
      const tex = new THREE.CanvasTexture(cv); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.set(.32, .32, 1); s.position.set(x, .02, z); scene.add(s); return s;
    }
    for (let i = 0; i < 8; i++) { label('abcdefgh'[i], i - 3.5, 4.22); label('abcdefgh'[i], i - 3.5, -4.22); label(String(8 - i), -4.22, i - 3.5); label(String(8 - i), 4.22, i - 3.5); }

    const tw = tweens();
    const view = { stage, renderer, scene, camera, flipped: false, els: new Map(), flat: false, yaw: 0, auto: !!opts.autoOrbit, onClick: opts.onClick };
    // sparks for on-board sword fights
    const SPN = 50, spPos = new Float32Array(SPN * 3), spVel = []; for (let i = 0; i < SPN; i++) spVel.push(new THREE.Vector3());
    const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: srgb(0xffe08a), size: .08, transparent: true, opacity: 0, depthWrite: false })); scene.add(sparks);
    let sparkT = 0, shake = 0;
    function burst(x, y, z) { for (let i = 0; i < SPN; i++) { spPos[i * 3] = x; spPos[i * 3 + 1] = y; spPos[i * 3 + 2] = z; spVel[i].set((Math.random() - .5) * 4, Math.random() * 3.5 + .5, (Math.random() - .5) * 4); } sparks.material.opacity = 1; sparkT = 0; shake = .22; }
    // camera control
    const camState = { yaw: 0, pitch: 1.02, radius: 13.5, tyaw: 0, tpitch: 1.02, tradius: 13.5, zoom: 1 };
    function placeCamera() {
      const p = camState.pitch, y = camState.yaw, R = camState.radius * camState.zoom;
      camera.position.set(Math.sin(y) * Math.cos(p) * R, Math.sin(p) * R, Math.cos(y) * Math.cos(p) * R);
      camera.lookAt(0, -.2, 0);
    }
    view.layout = () => { camState.tyaw = view.flipped ? Math.PI : 0; view.yaw = 0; };
    view.setView = mode => { view.mode = mode; const P = { '2d': [1.5, 12.5], '3d': [1.02, 13.5], 'vr': [.42, 10] }[mode] || [1.02, 13.5]; camState.tpitch = P[0]; camState.tradius = P[1]; };
    view.zoomBy = f => { camState.zoom = Math.min(1.8, Math.max(.55, camState.zoom * f)); };
    renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); view.zoomBy(e.deltaY > 0 ? 1.08 : .93); }, { passive: false });
    // faint arrows for legal moves
    const arrows = new THREE.Group(); scene.add(arrows);
    const arrowMat = { move: new THREE.MeshBasicMaterial({ color: srgb(0x33c46f), transparent: true, opacity: .38, depthWrite: false }), cap: new THREE.MeshBasicMaterial({ color: srgb(0xe4483a), transparent: true, opacity: .42, depthWrite: false }) };
    function arrowGeo(len) {
      const s = new THREE.Shape(); const w = .11, hw = .26, hl = .34, L = Math.max(len - .18, .5);
      s.moveTo(-w, .3); s.lineTo(w, .3); s.lineTo(w, L - hl); s.lineTo(hw, L - hl); s.lineTo(0, L); s.lineTo(-hw, L - hl); s.lineTo(-w, L - hl); s.closePath();
      return new THREE.ShapeGeometry(s);
    }
    view.showArrows = (from, moves) => {
      view.clearArrows();
      const dirs = {};
      moves.forEach(m => {
        const dr = m.to[0] - from[0], dc = m.to[1] - from[1];
        const isSlide = m.piece[1] === 'R' || m.piece[1] === 'B' || m.piece[1] === 'Q';
        const key = isSlide ? (Math.sign(dr) + ',' + Math.sign(dc)) : (dr + ',' + dc);
        const d = Math.hypot(dr, dc);
        if (!dirs[key] || dirs[key].d < d) dirs[key] = { d, dr, dc, cap: !!m.capture };
      });
      Object.values(dirs).forEach(a => {
        const len = Math.hypot(a.dr, a.dc);
        const mesh = new THREE.Mesh(arrowGeo(len), a.cap ? arrowMat.cap : arrowMat.move);
        mesh.rotation.x = -Math.PI / 2; // shape +y -> -z
        mesh.position.set(from[1] - 3.5, .012, from[0] - 3.5);
        const ang = Math.atan2(a.dc, -a.dr); // rotate around y so +(-z) points to (dr,dc)
        mesh.rotation.z = -ang;
        arrows.add(mesh);
      });
    };
    // chase animation: victim flees across the board, attacker catches it
    view.chase = (attH, vicH, m, board, onHop, onCatch) => new Promise(res => {
      const A = attH.obj, V = vicH.obj;
      const to = m.to, from = m.from;
      const occupied = (r, c) => board[r] && board[r][c] && !(r === from[0] && c === from[1]) && !(r === to[0] && c === to[1]);
      const path = [to]; let cur = to, prev = null;
      for (let i = 0; i < 3; i++) {
        const opts = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const r = cur[0] + dr, c = cur[1] + dc; if (r < 0 || r > 7 || c < 0 || c > 7) continue; if (occupied(r, c)) continue; if (prev && r === prev[0] && c === prev[1]) continue; opts.push([r, c]); }
        if (!opts.length) break; prev = cur; cur = opts[Math.floor(Math.random() * opts.length)]; path.push(cur);
      }
      path.push(to);
      const aPath = [from].concat(path.slice(0, -1)).concat([to]);
      const P = (rc) => new THREE.Vector3(rc[1] - 3.5, 0, rc[0] - 3.5);
      const hop = 240, n = path.length - 1, total = n * hop + 520;
      const vHop = V.userData.type[1] === 'N' ? .8 : .35, aHop = A.userData.type[1] === 'N' ? .9 : .4;
      V.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; } });
      let lastHop = -1, caught = false;
      const t0 = performance.now();
      tw.add(total, k => {
        const t = k * total;
        const seg = t / hop;
        // victim
        const vi = Math.min(n - 1, Math.floor(seg)), vk = Math.min(1, seg - vi);
        if (seg < n) { V.position.lerpVectors(P(path[vi]), P(path[vi + 1]), ease(vk)); V.position.y = Math.sin(vk * Math.PI) * vHop; V.rotation.z = Math.sin(vk * Math.PI * 2) * .12; if (vi !== lastHop) { lastHop = vi; onHop && onHop(); } }
        // attacker lags half a hop
        const as = Math.max(0, seg - .5), ai = Math.min(n - 1, Math.floor(as)), ak = Math.min(1, as - ai);
        if (as < n) { A.position.lerpVectors(P(aPath[ai]), P(aPath[ai + 1]), ease(ak)); A.position.y = Math.sin(ak * Math.PI) * aHop; A.rotation.z = -Math.sin(ak * Math.PI * 2) * .1; }
        else { A.position.copy(P(to)); A.position.y = 0; A.rotation.z = 0; }
        if (seg >= n) { // caught: victim topples & fades
          const c = Math.min(1, (t - n * hop) / 500);
          if (!caught) { caught = true; onCatch && onCatch(); }
          V.position.copy(P(to)); V.position.y = 0; V.rotation.z = -1.5 * ease(c); V.position.x += .3 * c;
          V.traverse(o => { if (o.isMesh) o.material.opacity = 1 - Math.max(0, (c - .4) / .6); });
          A.position.y = Math.max(0, Math.sin(Math.min(1, c * 2) * Math.PI) * .5);
        }
      }, () => { A.position.copy(P(to)); A.position.y = 0; A.rotation.z = 0; res(); });
    });
    // sword fight ON the board: attacker hops next to the victim, both draw swords, two clashes, victim falls, attacker takes the square.
    // No running around - about 1.8 s total.
    view.swordFight = (attH, vicH, m, cb) => new Promise(res => {
      cb = cb || {};
      const A = attH.obj, V = vicH.obj;
      const P = rc => new THREE.Vector3(rc[1] - 3.5, 0, rc[0] - 3.5);
      const pFrom = P(m.from), pTo = P(m.to), pVic = V.position.clone(); pVic.y = 0;
      const dir = pVic.clone().sub(pFrom); dir.y = 0; const dist = dir.length() || 1; dir.normalize();
      const stand = pVic.clone().sub(dir.clone().multiplyScalar(Math.min(.85, dist * .7)));
      const setName = SETS[curSet] || SETS.classic;
      const swordFor = (grp, colorHex, toward) => {
        const pv = new THREE.Group(); pv.position.y = .5;
        const ry = grp.rotation.y; pv.rotation.y = Math.atan2(-toward.z, toward.x) - ry;
        const sw = sword(colorHex); sw.position.set(.36, 0, 0); sw.scale.setScalar(.95); pv.add(sw); grp.add(pv);
        pv.scale.setScalar(.001); return { pv, sw };
      };
      const back = dir.clone().negate();
      const SA = swordFor(A, A.userData.type[0] === 'w' ? setName.wTrim : setName.bTrim, dir);
      const SV = swordFor(V, V.userData.type[0] === 'w' ? setName.wTrim : setName.bTrim, back);
      V.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; } });
      const hopA = A.userData.type[1] === 'N' ? .8 : .4;
      let drawn = false, hit1 = false, hit2 = false, fell = false;
      const T = 1850;
      tw.add(T, k => {
        const t = k * T;
        // 0-330: attacker hops beside victim
        if (t <= 330) { const e = ease(t / 330); A.position.lerpVectors(pFrom, stand, e); A.position.y = Math.sin(e * Math.PI) * hopA; }
        // 330-520: both draw swords (scale up + rise)
        if (t > 330 && t <= 520) { const e = ease((t - 330) / 190); A.position.copy(stand); A.position.y = 0; SA.pv.scale.setScalar(Math.max(.001, e)); SV.pv.scale.setScalar(Math.max(.001, e)); SA.sw.rotation.z = .9 * e; SV.sw.rotation.z = .6 * e; if (!drawn) { drawn = true; cb.onDraw && cb.onDraw(); } }
        // 520-680: strike 1 (swing toward victim), clash at ~640
        if (t > 520 && t <= 680) { const e = ease((t - 520) / 160); SA.pv.scale.setScalar(1); SV.pv.scale.setScalar(1); SA.sw.rotation.z = .9 - 2.1 * e; A.position.copy(stand).add(dir.clone().multiplyScalar(.18 * e)); A.rotation.z = 0; SV.sw.rotation.z = .6 - .9 * e; }
        if (t > 640 && !hit1) { hit1 = true; const mid = stand.clone().lerp(pVic, .55); burst(mid.x, .9, mid.z); cb.onClang && cb.onClang(); }
        // 680-900: recoil, victim staggers, attacker winds up again
        if (t > 680 && t <= 900) { const e = ease((t - 680) / 220); SA.sw.rotation.z = -1.2 + 2.3 * e; A.position.copy(stand).add(dir.clone().multiplyScalar(.18 * (1 - e))); V.position.copy(pVic).add(dir.clone().multiplyScalar(.12 * Math.sin(e * Math.PI))); V.rotation.z = -.15 * Math.sin(e * Math.PI); SV.sw.rotation.z = -.3 + .9 * e; }
        // 900-1060: strike 2 - the winning blow
        if (t > 900 && t <= 1060) { const e = ease((t - 900) / 160); SA.sw.rotation.z = 1.1 - 2.6 * e; A.position.copy(stand).add(dir.clone().multiplyScalar(.28 * e)); V.position.copy(pVic); }
        if (t > 1020 && !hit2) { hit2 = true; const mid = stand.clone().lerp(pVic, .6); burst(mid.x, 1.0, mid.z); cb.onClang && cb.onClang(); }
        // 1060-1500: victim's sword flies off, victim topples and fades; attacker steps back a touch
        if (t > 1060) { const e = ease(clamp01((t - 1060) / 440));
          SV.pv.position.y = .5 + 1.4 * e; SV.pv.position.x = -.6 * e; SV.sw.rotation.z = -.3 + 5 * e; SV.pv.scale.setScalar(Math.max(.001, 1 - e));
          V.position.copy(pVic).add(dir.clone().multiplyScalar(.35 * e)); V.rotation.z = -1.55 * e; V.position.y = .08 * Math.sin(e * Math.PI);
          V.traverse(o => { if (o.isMesh && o.material.opacity !== undefined) o.material.opacity = 1 - clamp01((t - 1250) / 300); });
          if (!fell && e > .35) { fell = true; cb.onFall && cb.onFall(); }
          SA.sw.rotation.z = -1.5 + 1.3 * Math.min(1, e * 1.5); A.position.copy(stand).add(dir.clone().multiplyScalar(.28 * (1 - Math.min(1, e * 2)))); }
        // 1500-1850: attacker hops onto the square, sword raised in victory then sheathed
        if (t > 1500) { const e = ease((t - 1500) / 350); A.position.lerpVectors(stand, pTo, e); A.position.y = Math.sin(e * Math.PI) * .45; SA.sw.rotation.z = -.2 - .6 * Math.sin(e * Math.PI); SA.pv.scale.setScalar(Math.max(.001, 1 - Math.max(0, (e - .6) / .4))); }
      }, () => { A.remove(SA.pv); V.remove(SV.pv); A.position.copy(pTo); A.position.y = 0; A.rotation.z = 0; res(); });
    });
    view.clearArrows = () => { while (arrows.children.length) { const m = arrows.children.pop(); m.geometry.dispose(); } };
    view.sync = board => {
      view.els.forEach(p => scene.remove(p.obj)); view.els.clear();
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = board[r][c]; if (!p) continue;
        const obj = makePiece(p, c < 4 ? 1 : -1); obj.position.set(c - 3.5, 0, r - 3.5); scene.add(obj);
        const h = { obj, sel: false, remove() { scene.remove(obj); }, classList: { add(k) { if (k === 'sel') h.sel = true; }, remove(k) { if (k === 'sel') { h.sel = false; obj.position.y = 0; } } } };
        view.els.set(r * 8 + c, h);
      }
    };
    view.setPos = (h, r, c) => {
      const from = h.obj.position.clone(), to = new THREE.Vector3(c - 3.5, 0, r - 3.5);
      const hop = h.obj.userData.type[1] === 'N' ? .9 : .25;
      h.sel = false;
      tw.add(380, k => { const e = ease(k); h.obj.position.lerpVectors(from, to, e); h.obj.position.y = Math.sin(k * Math.PI) * hop; }, () => h.obj.position.copy(to));
    };
    view.sqEl = (r, c) => { const m = marks[r * 8 + c]; return { classList: { add(k) { if (m[k]) m[k].visible = true; }, remove(k) { if (m[k]) m[k].visible = false; } } }; };
    view.clearMarks = () => { Object.values(marks).forEach(m => Object.values(m).forEach(x => x.visible = false)); view.els.forEach(h => { h.sel = false; }); view.clearArrows(); };
    // pointer: tap vs orbit-drag
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null; const touches = new Map(); let pinch0 = 0, zoom0 = 1;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', e => { touches.set(e.pointerId, [e.clientX, e.clientY]); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = camState.zoom; down = null; return; } down = { x: e.clientX, y: e.clientY, yaw: camState.tyaw, moved: false }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]); if (touches.size === 2 && pinch0) { const [a, b] = [...touches.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); camState.zoom = Math.min(1.8, Math.max(.55, zoom0 * pinch0 / d)); return; } if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true; if (down.moved) { camState.tyaw = down.yaw - dx * .006; camState.yaw = camState.tyaw; } });
    el.addEventListener('pointerup', e => {
      touches.delete(e.pointerId); if (touches.size < 2) pinch0 = 0;
      if (!down) return; const wasTap = !down.moved; down = null;
      if (!wasTap || !view.onClick) return;
      const rect = el.getBoundingClientRect(); ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects(squares, false)[0];
      if (hit) view.onClick(hit.object.userData.r, hit.object.userData.c);
    });
    el.addEventListener('pointercancel', e => { touches.delete(e.pointerId); down = null; });
    // resize
    new ResizeObserver(() => { const w = stage.clientWidth, h = stage.clientHeight; if (w > 0 && h > 0) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); } }).observe(stage);
    // loop
    let last = performance.now();
    function loop(now) {
      requestAnimationFrame(loop);
      if (!stage.offsetParent) return; // hidden screen: skip
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (view.auto) camState.tyaw += dt * .12;
      camState.yaw += (camState.tyaw - camState.yaw) * .1; camState.pitch += (camState.tpitch - camState.pitch) * .1; camState.radius += (camState.tradius - camState.radius) * .1;
      placeCamera();
      if (shake > .001) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake *= .86; }
      if (sparks.material.opacity > 0) { sparkT += dt; for (let i = 0; i < SPN; i++) { spVel[i].y -= 9 * dt; spPos[i * 3] += spVel[i].x * dt; spPos[i * 3 + 1] += spVel[i].y * dt; spPos[i * 3 + 2] += spVel[i].z * dt; } spGeo.attributes.position.needsUpdate = true; sparks.material.opacity = Math.max(0, 1 - sparkT * 1.8); }
      tw.step(now);
      const bob = Math.sin(now / 160) * .12 + .14;
      view.els.forEach(h => { if (h.sel) h.obj.position.y = bob; });
      Object.values(marks).forEach(m => { if (m.check.visible) m.check.material.opacity = .4 + Math.sin(now / 150) * .25; });
      renderer.render(scene, camera);
    }
    placeCamera(); requestAnimationFrame(loop);
    return view;
  }

  // ---- duel scene ----
  let duelCtx = null;
  function duelSetup(arena) {
    const w = arena.clientWidth || 700, h = arena.clientHeight || 400;
    const renderer = makeRenderer(w, h); renderer.domElement.className = 'gl';
    arena.insertBefore(renderer.domElement, arena.firstChild);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, w / h, .1, 50);
    lights(scene, 5);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: srgb(0x2b2040), roughness: .95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ color: srgb(0xf2b636), transparent: true, opacity: .22 })); glow.rotation.x = -Math.PI / 2; glow.position.y = .01; scene.add(glow);
    // sparks
    const N = 60, pos = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) vel.push(new THREE.Vector3());
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: srgb(0xffe08a), size: .09, transparent: true, opacity: 0 })); scene.add(sparks);
    new ResizeObserver(() => { const W = arena.clientWidth, H = arena.clientHeight; if (W && H) { renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); } }).observe(arena);
    duelCtx = { renderer, scene, camera, sparks, pos, vel, N };
  }
  function sword(color) {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.1, .02), mat(0xdfe7f0, { metalness: .8, roughness: .25 })); blade.position.y = .75; g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.045, .18, 4), mat(0xdfe7f0, { metalness: .8, roughness: .25 })); tip.position.y = 1.38; tip.rotation.y = Math.PI / 4; g.add(tip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(.32, .06, .06), mat(color, { metalness: .5, roughness: .3 })); guard.position.y = .2; g.add(guard);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .3, 10), mat(0x5a3620)); g.add(grip);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function duel3d(arena, att, vic, onImpact, onFall) {
    if (!duelCtx) duelSetup(arena);
    const { renderer, scene, camera, sparks, pos, vel, N } = duelCtx;
    const A = makePiece(att), V = makePiece(vic);
    A.rotation.y = 0; V.rotation.y = 0; // face camera-ish
    if (att[1] === 'N') A.rotation.y = Math.PI / 2; if (vic[1] === 'N') V.rotation.y = -Math.PI / 2;
    const S = sword(att[0] === 'w' ? COL.wTrim : COL.bTrim); S.position.set(.36, .55, .1); S.rotation.z = -.4; A.add(S);
    const S2 = sword(vic[0] === 'w' ? COL.wTrim : COL.bTrim); S2.position.set(-.36, .55, .1); S2.rotation.z = .4; V.add(S2);
    const scale = 1.35; A.scale.setScalar(scale); V.scale.setScalar(scale);
    scene.add(A); scene.add(V);
    V.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; } });
    let impacted = false, fell = false;
    const t0 = performance.now(); let raf;
    function frame(now) {
      const t = (now - t0) / 1000; // seconds
      // phases
      const inK = ease(clamp01(t / .35));
      A.position.x = -4 + inK * 2.7; V.position.x = 4 - inK * 2.7;
      let ax = 0, arot = 0, srot = -.4;
      if (t > .35 && t <= .6) { const k = (t - .35) / .25; arot = -.35 * k; srot = -.4 - 2.2 * k; }
      else if (t > .6 && t <= .8) { const k = ease((t - .6) / .2); ax = 1.6 * k; arot = -.35 + .7 * k; srot = -2.6 + 3.4 * k; }
      else if (t > .8) { const k = ease(clamp01((t - .8) / .5)); ax = 1.6 - .3 * k; arot = .35 - .35 * k; srot = .8 - 1.2 * k; }
      A.position.x += ax; A.rotation.z = arot; S.rotation.z = srot;
      if (t > .78 && !impacted) { impacted = true; onImpact && onImpact(); for (let i = 0; i < N; i++) { pos[i * 3] = .3; pos[i * 3 + 1] = 1.2; pos[i * 3 + 2] = .2; vel[i].set((Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 4); } sparks.material.opacity = 1; }
      if (impacted) { const dt = 1 / 60; for (let i = 0; i < N; i++) { vel[i].y -= 9 * dt; pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt; } sparks.geometry.attributes.position.needsUpdate = true; sparks.material.opacity = Math.max(0, 1 - (t - .78) * 1.6); }
      if (t > .8) { const k = ease(clamp01((t - .8) / .7)); V.rotation.z = -1.65 * k; V.position.x += 1.2 * k; V.position.y = .15 * Math.sin(k * Math.PI); if (k > .3 && !fell) { fell = true; onFall && onFall(); } V.traverse(o => { if (o.isMesh) o.material.opacity = 1 - clamp01((t - 1.2) / .5); }); }
      // camera with shake
      const sh = (t > .78 && t < 1.15) ? (1.15 - t) * .25 : 0;
      camera.position.set((Math.random() - .5) * sh, 1.9 + (Math.random() - .5) * sh, 5.2); camera.lookAt(0, .9, 0);
      renderer.render(scene, camera);
      if (t < 1.75) raf = requestAnimationFrame(frame); else { scene.remove(A); scene.remove(V); sparks.material.opacity = 0; }
    }
    raf = requestAnimationFrame(frame);
  }
  function setPieceSet(name) {
    const s = SETS[name] || SETS.classic;
    curSet = SETS[name] ? name : 'classic';
    buildMaterials();
    const r = document.documentElement.style;
    r.setProperty('--w-fill', '#' + s.wFill.toString(16).padStart(6, '0')); r.setProperty('--b-fill', '#' + s.bFill.toString(16).padStart(6, '0'));
    r.setProperty('--w-line', s.wLine); r.setProperty('--b-line', s.bLine);
  }
  return { buildBoard, duel3d, makePiece, setPieceSet, SETS, sword };
})();
