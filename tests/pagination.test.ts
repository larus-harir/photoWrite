import { describe, expect, it } from 'vitest';
import { exampleProject } from '../src/defaults';
import { orderedPages, paginate, textGeometry, wrapText } from '../src/lib/pagination';
const measure=(s:string)=>Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(s)).length*36;
const build=(body:string)=>paginate({...exampleProject(),body},()=>measure);
describe('lossless Korean pagination',()=>{
  it('preserves Korean, English, punctuation, emoji, blank lines, CRLF and trailing newlines',()=>{
    const body=('한글과 English words, “인용” 理想. 👨‍👩‍👧‍👦 café\r\n\n  공백도 그대로.\n\n').repeat(80)+'마지막\n';
    const pages=build(body).filter(p=>p.kind==='text');
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.map(p=>p.source).join('')).toBe(body);
    for(const p of pages){
      const geo=textGeometry(p.style,1.65);
      expect(p.lines.length).toBeLessThanOrEqual(geo.capacity);
      for(const line of p.lines) expect(measure(line.text)).toBeLessThanOrEqual(geo.width);
    }
  });
  it('does not split a family emoji in the middle',()=>{
    const lines=wrapText('👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦',measure,40);
    expect(lines.map(l=>l.text)).toEqual(['👨‍👩‍👧‍👦','👨‍👩‍👧‍👦','👨‍👩‍👧‍👦']);
  });
  it('keeps a fitting paragraph together on the next page',()=>{
    const first=Array(10).fill('한 줄\n').join('')+'\n';
    const second='나의 새 문단\n두 번째 줄\n세 번째 줄\n네 번째 줄\n다섯 번째 줄';
    const pages=build(first+second).filter(p=>p.kind==='text');
    expect(pages[1].source).toBe(second);
    expect(pages[0].source).toBe(first);
  });
  it('safely splits a paragraph longer than one page without losing text',()=>{
    const body='아주 긴 하나의 문단입니다. '.repeat(1500);
    const pages=build(body).filter(p=>p.kind==='text');
    expect(pages.length).toBeGreaterThan(20);
    expect(pages.map(p=>p.source).join('')).toBe(body);
  });
  it('honors manual page delimiters without rendering them',()=>{
    const pages=build('첫 페이지\n---page---\n둘째 페이지').filter(p=>p.kind==='text');
    expect(pages).toHaveLength(2);
    expect(pages[0].source).toBe('첫 페이지\n');
    expect(pages[1].source).toBe('\n둘째 페이지');
    expect(pages.map(p=>p.source).join('')).not.toContain('---page---');
  });
  it('makes only cover and photo pages when body is empty',()=>{
    expect(build(' \n ').map(p=>p.kind)).toEqual(['cover','photo']);
  });
  it('remeasures a page-specific font and margin before allocating lines',()=>{
    const p={...exampleProject(),body:'다양한 문자가 있는 긴 글입니다. '.repeat(250),pageStyles:{'text-0-0':{fontSize:48,margin:140,showTitle:false}}};
    const pages=paginate(p,size=>s=>measure(s)*size/36).filter(p=>p.kind==='text');
    expect(pages[0].style.fontSize).toBe(48);
    for(const page of pages){const geo=textGeometry(page.style,p.lineHeight);expect(page.lines.length).toBeLessThanOrEqual(geo.capacity);}
    expect(pages.map(p=>p.source).join('')).toBe(p.body);
  });
  it('reorders without changing source pages or duplicating missing IDs',()=>{
    const pages=build('첫 글\n---page---\n다음 글');
    const result=orderedPages(pages,['photo','cover','no-such-id']);
    expect(result.map(p=>p.id)).toEqual(['photo','cover','text-0-0','text-1-0']);
    expect(new Set(result.map(p=>p.id)).size).toBe(pages.length);
  });
});
