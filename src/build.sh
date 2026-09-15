#!/bin/bash
# Ghép src/ thành index.html (chạy từ bất kỳ đâu): bash src/build.sh
cd "$(dirname "$0")"
python - <<'PY'
h=open('head.html',encoding='utf-8').read().replace('__KEN__',open('ken.b64',encoding='utf-8').read().strip())
out=h+open('engine.js',encoding='utf-8').read()+open('view3d.js',encoding='utf-8').read()+open('app.js',encoding='utf-8').read()+'</script>\n</body>\n</html>\n'
open('../index.html','w',encoding='utf-8',newline='\n').write(out)
print('built ../index.html',len(out),'bytes')
PY
