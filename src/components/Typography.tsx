import type { Project } from '../types';
import { fonts, fontFamily } from '../lib/fonts';
import type { FontId } from '../lib/fonts';
export function Typography({project:p,onChange}:{project:Project;onChange:(p:Partial<Project>)=>void}) {
  return <section className="form-section typography-section"><div className="section-label"><h2>글꼴과 크기</h2><span className="section-note">레퍼런스 기본값</span></div>
    <label className="field"><span>제목 글꼴</span><select aria-label="제목 글꼴" value={p.titleFont} onChange={e=>onChange({titleFont:e.target.value as FontId})}>{fonts.map(f=><option key={f.id} value={f.id}>{f.name}{f.id==='noto-sans'?' · 기본':''}</option>)}</select></label>
    <label className="field"><span>본문·부제 글꼴</span><select aria-label="본문·부제 글꼴" value={p.bodyFont} onChange={e=>onChange({bodyFont:e.target.value as FontId})}>{fonts.map(f=><option key={f.id} value={f.id}>{f.name}{f.id==='noto-sans'?' · 기본':''}</option>)}</select></label>
    <details className="font-gallery"><summary>선별한 글꼴 미리 보기</summary>{fonts.map(f=><div className="font-specimen" key={f.id}><h3>{f.name}</h3><p style={{fontFamily:fontFamily(f.id)}}>오래 남기고 싶은 장면</p><small>{f.mood}</small><div><button aria-pressed={p.titleFont===f.id} onClick={()=>onChange({titleFont:f.id})}>제목에 적용</button><button aria-pressed={p.bodyFont===f.id} onClick={()=>onChange({bodyFont:f.id})}>본문에 적용</button><a href={f.source} target="_blank" rel="noreferrer">배포처 ↗</a></div></div>)}</details>
    <label className="field"><span>표지 제목 크기 · {p.coverTitleSize??(p.template==='original'?106:68)} px</span><input type="range" aria-label="표지 제목 크기" min={36} max={120} value={p.coverTitleSize??(p.template==='original'?106:68)} onChange={e=>{if(e.target.value)onChange({coverTitleSize:Math.max(36,Math.min(120,+e.target.value))});}}/></label>
    <label className="field"><span>본문 페이지 제목 크기 · {p.textTitleSize??(p.template==='original'?82:66)} px</span><input type="range" aria-label="본문 페이지 제목 크기" min={28} max={88} value={p.textTitleSize??(p.template==='original'?82:66)} onChange={e=>{if(e.target.value)onChange({textTitleSize:Math.max(28,Math.min(88,+e.target.value))});}}/></label>
    <label className="field"><span>부제 크기 · {p.subtitleSize??(p.template==='original'?48:28)} px</span><input type="range" aria-label="부제 크기" min={18} max={56} value={p.subtitleSize??(p.template==='original'?48:28)} onChange={e=>{if(e.target.value)onChange({subtitleSize:Math.max(18,Math.min(56,+e.target.value))});}}/></label>
    <p className="hint">본문 크기와 줄 간격은 아래에서 조절하세요. 글꼴을 바꾸면 원문을 유지하며 페이지를 다시 나눕니다. 긴 제목은 겹치지 않도록 선택한 크기 안에서 맞춥니다.</p>
    <button className="text-button" onClick={()=>onChange({titleFont:'noto-sans',bodyFont:'noto-sans',coverTitleSize:undefined,textTitleSize:undefined,subtitleSize:undefined,fontSize:36,lineHeight:1.65})}>레퍼런스 글꼴·크기로 복원</button>
  </section>;
}
