import re
h=open('index.html').read()
# strip document skeleton: keep head inner + body inner
head=re.search(r'<head>(.*?)</head>',h,re.S).group(1)
body=re.search(r'<body>(.*)</body>',h,re.S).group(1)
head=re.sub(r'\s*<meta[^>]*>','',head)
old="else if (m === 'online') { show('Online'); const ok = await Net.load();"
new="else if (m === 'online') { show('Online'); if (window.claude) { $('#btnCreate').disabled = $('#btnJoin').disabled = true; $('#hostStatus').textContent = $('#joinStatus').textContent = 'Bản xem thử này chưa chơi online được — hãy dùng bản web riêng của lớp.'; $('#hostStatus').className = $('#joinStatus').className = 'status err'; return; } const ok = await Net.load();"
assert old in body
body=body.replace(old,new)
out=head.strip()+'\n'+body
open('/tmp/claude-0/-home-claude/663d5c94-b10c-5d14-b9ca-de425512b68a/scratchpad/co-vua-chien-binh.html','w').write(out)
print(len(out))
