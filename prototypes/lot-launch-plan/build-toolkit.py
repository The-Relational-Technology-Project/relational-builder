import re,html,json,sys
from html.parser import HTMLParser
src,out=sys.argv[1],sys.argv[2]
URL='https://www.shareable.net/toolkit/library-of-things/'
h=open(src,encoding='utf-8',errors='ignore').read()
b=h[h.find('<body'):]
b=re.sub(r'<(script|style|svg|noscript)\b.*?</\1>','',b,flags=re.S)
s=b.find('<h1'); e=b.find('You might also like')
b=b[s:e]
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.chunks=[]; s.path={3:'',4:''}; s.section=''; s.cur=None; s.buf=[]; s.inh=None; s.hid=None; s.htxt=[]; s.href=None; s.atxt=[]; s.skip=0
        s.new('Introduction','', 'Introduction','')
    def new(s,section,chapter,heading,anchor):
        s.flush()
        s.cur=dict(section=section,chapter=chapter,heading=heading,anchor=anchor)
    def flush(s):
        if s.cur is not None:
            t=re.sub(r'[ \t\xa0]+',' ',''.join(s.buf)); t=re.sub(r' *\n *','\n',t); t=re.sub(r'\n{3,}','\n\n',t).strip()
            if len(t)>40: s.cur['text']=t; s.chunks.append(s.cur)
        s.buf=[]
    def handle_starttag(s,tag,a):
        a=dict(a)
        if tag=='button' and 'toggle' not in (a.get('class') or ''): s.skip+=1
        if tag in('h1','h2','h3','h4','h5','h6'):
            s.inh=int(tag[1]); s.hid=a.get('id'); s.htxt=[]
        elif tag=='a' and s.inh is None: s.href=a.get('href'); s.atxt=[]
        elif tag=='li': s.buf.append('\n- ')
        elif tag in('p','ul','ol','blockquote','tr'): s.buf.append('\n\n')
        elif tag=='br': s.buf.append('\n')
        elif tag=='iframe' and a.get('src'): s.buf.append('\n\n[video](%s)\n\n'%a['src'])
    def handle_endtag(s,tag):
        if tag=='button' and s.skip: s.skip-=1
        if s.inh and tag=='h%d'%s.inh:
            t=re.sub(r'\s+',' ',''.join(s.htxt)).strip().rstrip('+').replace('🛠️','').strip(); lv=s.inh; s.inh=None
            if not t: return
            if lv<=2: return
            if lv==3:
                if re.match(r'(Section \d+|Conclusion|Credits|Appendix)',t):
                    s.section=t; s.new(t,'',t,s.hid or '')
                else: s.chap=t; s.new(s.section,t,t,s.hid or '')
                s.chapname=t if not re.match(r'(Section \d+|Conclusion|Credits|Appendix)',t) else ''
            elif lv==4: s.new(s.section,getattr(s,'chapname',''),t,s.hid or s.cur['anchor'])
            else: s.buf.append('\n\n### %s\n\n'%t)
        elif tag=='a' and s.href is not None:
            t=''.join(s.atxt).strip(); hr=s.href; s.href=None
            if t:
                if hr.startswith('#'): hr=URL+hr
                s.buf.append('[%s](%s)'%(t,hr) if hr.startswith('http') else t)
        elif tag in('p','li','td','th'): s.buf.append(' ')
    def handle_data(s,d):
        if s.skip and s.inh is None: return
        if s.inh is not None: s.htxt.append(d)
        elif s.href is not None: s.atxt.append(d)
        else: s.buf.append(d)
p=P(); p.feed(b); p.flush()
# split oversize chunks on paragraph boundaries
final=[]
for c in p.chunks:
    t=c['text']; parts=[]
    if len(t.split())>700:
        cur=[];n=0
        for para in t.split('\n\n'):
            w=len(para.split())
            if n+w>550 and cur: parts.append('\n\n'.join(cur)); cur=[];n=0
            cur.append(para); n+=w
        if cur: parts.append('\n\n'.join(cur))
    else: parts=[t]
    for i,pt in enumerate(parts):
        d=dict(c); d['text']=pt
        if len(parts)>1: d['part']='%d/%d'%(i+1,len(parts))
        final.append(d)
for i,c in enumerate(final):
    c['id']='lot-%03d'%i; c['url']=URL+('#'+c['anchor'] if c['anchor'] else ''); del c['anchor']; c['words']=len(c['text'].split())
doc=dict(title='Library of Things Toolkit (2.0)',publisher='Shareable',source=URL,license='See source page',retrieved='2026-11-19',chunks=final)
json.dump(doc,open(out,'w'),ensure_ascii=False,indent=1)
ws=[c['words'] for c in final]
print(len(final),'chunks',sum(ws),'words','max',max(ws),'min',min(ws))
from collections import Counter
for k,v in Counter(c['section'] for c in final).items(): print(v,k)
