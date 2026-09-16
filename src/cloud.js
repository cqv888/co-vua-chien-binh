// ===== Cloud (Supabase): parent account, kid profiles with PIN, saved progress & settings =====
// The publishable key is safe to ship in the page; Row Level Security limits every request to the signed-in parent's rows.
const Cloud = (() => {
  const URL = 'https://fhyblgqnfvurjamymuvv.supabase.co';
  const KEY = 'sb_publishable_Nrx7SIfICKxLYTo0KO4TTQ_S66OsJka';
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  let sb = null, user = null, profiles = [], active = null, loading = null;
  const listeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) { } });

  function script(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Không tải được thư viện đăng nhập')); document.head.appendChild(s); }); }
  async function load() {
    if (sb) return sb;
    if (loading) return loading;
    loading = (async () => {
      if (typeof supabase === 'undefined') await script(LIB);
      sb = supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
      const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null;
      sb.auth.onAuthStateChange((_ev, s) => { const u = s ? s.user : null; const changed = (u && u.id) !== (user && user.id); user = u; if (changed) { if (!user) { profiles = []; active = null; } emit(); } });
      if (user) await refresh();
      return sb;
    })();
    return loading;
  }
  async function sha(text) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
  const pinHash = (id, pin) => sha(id + ':' + pin);

  async function refresh() {
    if (!user) { profiles = []; return; }
    const { data, error } = await sb.from('profiles').select('*').order('created_at');
    if (error) throw error;
    profiles = data || [];
    const savedId = store.get('activeProfile', null);
    if (active) active = profiles.find(p => p.id === active.id) || null;
    else if (savedId) active = profiles.find(p => p.id === savedId) || null;
    emit();
  }
  const friendly = e => {
    const m = (e && e.message) || String(e);
    if (/Invalid login/i.test(m)) return 'Sai email hoặc mật khẩu.';
    if (/already registered/i.test(m)) return 'Email này đã có tài khoản — hãy Đăng nhập.';
    if (/Password should be/i.test(m)) return 'Mật khẩu cần ít nhất 6 ký tự.';
    if (/Email not confirmed/i.test(m)) return 'Hãy mở email và bấm link xác nhận trước, rồi đăng nhập lại.';
    if (/rate limit/i.test(m)) return 'Thử lại sau ít phút (gửi email quá nhanh).';
    if (/relation .* does not exist|schema cache/i.test(m)) return 'Chưa tạo bảng trong Supabase — chạy file supabase/schema.sql trong SQL Editor.';
    return m;
  };

  return {
    load, refresh, friendly,
    onChange(f) { listeners.push(f); },
    get user() { return user; }, get profiles() { return profiles; }, get active() { return active; },
    async signIn(email, password) { await load(); const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; await refresh(); },
    async signUp(email, password) { await load(); const { data, error } = await sb.auth.signUp({ email, password }); if (error) throw error; if (data.session) await refresh(); return !!data.session; /* false = needs email confirm */ },
    async signOut() { await load(); await sb.auth.signOut(); user = null; profiles = []; active = null; store.set('activeProfile', null); emit(); },
    async addProfile(name, avatar, pin) {
      await load();
      const { data, error } = await sb.from('profiles').insert({ name, avatar, data: { games: 0, wins: {}, losses: 0, draws: 0 } }).select().single();
      if (error) throw error;
      if (pin) { const h = await pinHash(data.id, pin); const r = await sb.from('profiles').update({ pin_hash: h }).eq('id', data.id); if (r.error) throw r.error; }
      await refresh(); return data;
    },
    async removeProfile(id) { await load(); const { error } = await sb.from('profiles').delete().eq('id', id); if (error) throw error; if (active && active.id === id) { active = null; store.set('activeProfile', null); } await refresh(); },
    async setPin(id, pin) { await load(); const h = pin ? await pinHash(id, pin) : null; const { error } = await sb.from('profiles').update({ pin_hash: h }).eq('id', id); if (error) throw error; await refresh(); },
    async checkPin(p, pin) { if (!p.pin_hash) return true; return (await pinHash(p.id, pin)) === p.pin_hash; },
    select(p) { active = p; store.set('activeProfile', p ? p.id : null); emit(); },
    deselect() { active = null; store.set('activeProfile', null); emit(); },
    // merge a patch into the active kid's data bag and save
    async save(patch) {
      if (!active || !sb) return;
      const next = Object.assign({}, active.data || {}, patch);
      active.data = next;
      const i = profiles.findIndex(p => p.id === active.id); if (i >= 0) profiles[i].data = next;
      const { error } = await sb.from('profiles').update({ data: next }).eq('id', active.id);
      if (error) console.warn('save failed', error);
      emit();
    },
    async recordGame(level, result) { // result: 'win' | 'lose' | 'draw'
      if (!active) return;
      const d = Object.assign({ games: 0, wins: {}, losses: 0, draws: 0, history: [] }, active.data || {});
      d.games++; d.lastLevel = level;
      if (result === 'win') d.wins[level] = (d.wins[level] || 0) + 1; else if (result === 'lose') d.losses++; else d.draws++;
      d.history = (d.history || []).concat([{ t: Date.now(), level, result }]).slice(-50);
      await this.save(d);
    },
    applying: false, _pend: {}, _t: null,
    queueSetting(k, v) { if (this.applying || !active) return; this._pend[k] = v; clearTimeout(this._t); this._t = setTimeout(() => { const p = this._pend; this._pend = {}; this.saveSettings(p); }, 900); },
    saveSettings(settings) { if (!active) return; const d = active.data || {}; return this.save({ settings: Object.assign({}, d.settings || {}, settings) }); },
    totalWins(p) { const w = (p.data && p.data.wins) || {}; return Object.values(w).reduce((a, b) => a + b, 0); },
    // highest level with at least 3 wins unlocks the next one (just a badge, never blocks play)
    levelBadge(p) { const w = (p.data && p.data.wins) || {}; if ((w[3] || 0) >= 3) return '🌳 Cao thủ'; if ((w[2] || 0) >= 3) return '🌿 Giỏi'; if ((w[1] || 0) >= 3) return '🌱 Khá'; return '🐣 Mới'; }
  };
})();
