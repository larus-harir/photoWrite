import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent, ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Download, Expand, FileText, ImagePlus, Layers, Leaf, LoaderCircle, Maximize2, Minus, PanelLeftClose, Plus, RotateCcw, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Type, Upload, X } from 'lucide-react';
import { templates } from './types';
import type { PageStyle, Project } from './types';
import { bodyFont } from './lib/fonts';
import { Typography } from './components/Typography';
import { orderedPages, paginate } from './lib/pagination';
import { coverBox, photoPlacement } from './lib/render';
import { ensureFonts, loadImage, readPhoto } from './lib/media';
import { saveProject } from './lib/storage';
import { exportPages } from './lib/export';
import { PageCanvas } from './components/PageCanvas';

const kindNames = { cover: '표지', photo: '사진 · 정보', text: '본문' };
function Field({label, children, className = ''}: {label:string;children:ReactNode;className?:string}) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}
function Range({label,value,min,max,step=1,onChange,suffix=''}:{label:string;value:number;min:number;max:number;step?:number;onChange:(v:number)=>void;suffix?:string}) {
  return <label className="range-field"><span>{label}<b>{Number(value.toFixed(2))}{suffix}</b></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} /></label>;
}
function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(b:boolean)=>void}) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)}/><span className="switch"/></label>;
}
interface EditorProps { initialProject:Project; onSaved:(p:Project)=>void; onBack:()=>void; onExample:(index:number)=>Promise<void> }
export default function App({initialProject,onSaved,onBack,onExample}:EditorProps) {
  const [project,setProject] = useState<Project>(initialProject);
  const [leaving,setLeaving] = useState(false);
  const [saved,setSaved] = useState('브라우저에 저장됨');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [tab,setTab] = useState<'content'|'design'>('content');
  const [selected,setSelected] = useState('cover');
  const [image,setImage] = useState<HTMLImageElement | null>(null);
  const [fontReady,setFontReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [progress,setProgress] = useState('');
  const [resolution,setResolution] = useState(1);
  const [zoom,setZoom] = useState(100);
  const [help,setHelp] = useState(false);
  const [exportOpen,setExportOpen] = useState(false);
  const [focusPreview,setFocusPreview] = useState(false);
  const [dragOver,setDragOver] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{x:number;y:number;crop:Project['crop']} | null>(null);
  const patch = useCallback((updates:Partial<Project>)=>setProject(p=>({...p,...updates})),[]);

  useEffect(()=>{
    let active=true;
    setSaved('저장 중…');
    const timer=setTimeout(()=>{
      saveProject(project).then(p=>{if(active){setSaved('브라우저에 저장됨');onSaved(p);}}).catch(()=>{if(active){setSaved('저장 실패');setError('저장 공간이 부족하거나 브라우저 저장이 차단되었습니다. 작업을 닫기 전에 PNG로 내보내세요.');}});
    },550);
    return ()=>{active=false;clearTimeout(timer);};
  },[project,onSaved]);
  useEffect(()=>{
    const protectUnsaved=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    if(saved==='저장 중…'||saved==='저장 실패')window.addEventListener('beforeunload',protectUnsaved);
    return()=>window.removeEventListener('beforeunload',protectUnsaved);
  },[saved]);
  useEffect(()=>{
    let active=true;
    setImage(null);
    if(!project.photo)return;
    loadImage(project.photo).then(i=>{if(active)setImage(i);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[project.photo]);
  const fontText = [project.title,project.subtitle,project.body,project.handle,project.year,project.location,project.camera,project.film,project.description,project.number].join(' ');
  useEffect(()=>{
    let active=true;
    setFontReady(false);
    ensureFonts(fontText,[project.titleFont,project.bodyFont]).then(()=>{if(active)setFontReady(true);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[fontText,project.titleFont,project.bodyFont]);
  useEffect(()=>{if(notice){const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);}},[notice]);
  const naturalPages = useMemo(()=>{
    const measureCanvas=document.createElement('canvas');
    measureCanvas.lang='ko';
    const ctx=measureCanvas.getContext('2d')!;
    if('lang' in ctx)ctx.lang='ko';
    return paginate(project,size=>{ctx.font=`400 ${size}px ${bodyFont(project)}`;return text=>ctx.measureText(text).width;});
  // fontReady invalidates any fallback metrics after actual fonts load.
  },[project,fontReady]);
  const pages=useMemo(()=>orderedPages(naturalPages,project.pageOrder),[naturalPages,project.pageOrder]);
  const current=pages.find(p=>p.id===selected) ?? pages[0];
  const currentIndex=pages.indexOf(current);
  const template=templates.find(t=>t.id===project.template)!;
  const ready=fontReady && !!image;
  const lowResolution=!!project.photo && (project.photoWidth<1080*resolution || project.photoHeight<1350*resolution);
  const lowEffectiveResolution=useMemo(()=>{
    if (!image) return false;
    const box=coverBox(project);
    const rect=photoPlacement(project,image,box);
    return rect.w/image.naturalWidth*resolution>1.01;
  },[image,project,resolution]);

  async function upload(file?: File) {
    if(!file)return;
    try {
      const photo=await readPhoto(file);
      patch({...photo,crop:{x:.5,y:.5,zoom:1}});
      setSelected('cover');setNotice('사진을 불러왔습니다. 색감은 그대로 유지됩니다.');
    }catch(e){setError(e instanceof Error?e.message:'사진을 불러오지 못했습니다.');}
  }
  async function doExport(all:boolean) {
    if(!ready || busy) return;
    setBusy(true);setError('');
    try{
      await exportPages(project,all?pages:[current],resolution,all,setProgress,pages);
      setNotice(all?'캐러셀 ZIP 파일을 저장했습니다.':'현재 페이지 PNG를 저장했습니다.');
    }catch(e){setError(e instanceof Error?e.message:'내보내지 못했습니다. 기본 해상도로 다시 시도해 주세요.');}
    finally{setBusy(false);setProgress('');}
  }
  function fitPreview() {
    const viewport=previewRef.current;
    if(!viewport)return;
    const base=parseFloat(getComputedStyle(viewport).getPropertyValue('--preview-base'));
    const width=Math.min(viewport.clientWidth-48,Math.max(120,viewport.clientHeight-96)*.8);
    setZoom(Math.max(20,Math.min(200,Math.floor(width/base*100))));
  }
  function reorder(direction:number) {
    const target=currentIndex+direction;
    if(target<0||target>=pages.length)return;
    const ids=pages.map(p=>p.id);[ids[currentIndex],ids[target]]=[ids[target],ids[currentIndex]];
    patch({pageOrder:ids});
  }
  function setPageStyle(style:Partial<PageStyle>) {
    patch({pageStyles:{...project.pageStyles,[current.id]:{...project.pageStyles[current.id],...style}}});
  }
  function addBreak() {
    const element=bodyRef.current;
    const start=element?.selectionStart ?? project.body.length;
    const end=element?.selectionEnd ?? start;
    const marker=`${start>0 && project.body[start-1]!=='\n'?'\n':''}---page---\n`;
    patch({body:project.body.slice(0,start)+marker+project.body.slice(end),pageOrder:[]});
    requestAnimationFrame(()=>{element?.focus();element?.setSelectionRange(start+marker.length,start+marker.length);});
  }
  function editCurrentText() {
    let cursor=0;
    let start=0;
    for (const page of naturalPages.filter(p=>p.kind==='text')) {
      const offset=project.body.indexOf(page.source,cursor);
      if(page.id===current.id){start=offset;break;}
      cursor=offset+page.source.length;
    }
    setTab('content');
    requestAnimationFrame(()=>{
      const element=bodyRef.current;
      element?.focus();
      element?.setSelectionRange(start,start+current.source.length);
      if(element)element.scrollTop=element.scrollHeight*(start/Math.max(1,project.body.length));
    });
  }
  async function leave(exampleIndex?:number) {
    if(leaving||busy)return;
    setLeaving(true);
    try {
      const saved=await saveProject(project);onSaved(saved);onBack();
      if(exampleIndex!==undefined)await onExample(exampleIndex);
    } catch {setError('작업을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.');setLeaving(false);}
  }
  function pointerDown(e:PointerEvent<HTMLDivElement>) {
    if(current.kind!=='cover'||!image)return;
    drag.current={x:e.clientX,y:e.clientY,crop:{...project.crop}};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e:PointerEvent<HTMLDivElement>) {
    if(!drag.current||!image)return;
    const box=coverBox(project), rect=photoPlacement(project,image,box);
    const ratio=1080/e.currentTarget.getBoundingClientRect().width;
    const dx=(e.clientX-drag.current.x)*ratio,dy=(e.clientY-drag.current.y)*ratio;
    patch({crop:{...drag.current.crop,x:Math.max(0,Math.min(1,drag.current.crop.x-dx/Math.max(1,rect.w-box.w))),y:Math.max(0,Math.min(1,drag.current.crop.y-dy/Math.max(1,rect.h-box.h)))}});
  }
  const textInput=(key:'title'|'subtitle'|'number'|'handle'|'year'|'location'|'camera'|'film'|'description',placeholder:string,maxLength=100)=><input value={project[key]} placeholder={placeholder} maxLength={maxLength} onChange={e=>patch({[key]:e.target.value})}/>;

  return <div className={`app ${focusPreview?'focus-mode':''}`}>
    <header className="topbar">
      <a href="#" className="brand" aria-label="Frame and Words 홈" onClick={e=>{e.preventDefault();void leave();}}><span className="brand-icon"><Maximize2 size={21}/></span><span>FRAME <i>&</i> WORDS<small>사진과 문장 사이</small></span></a>
      <div className="project-crumb"><button disabled={leaving||busy} onClick={()=>void leave()}>나의 작업실</button><ChevronRight size={14}/><b>{project.title||'새로운 기록'}</b><span className="draft-pill">DRAFT</span></div>
      <div className="top-actions"><span className={`save-state ${saved.includes('실패')?'failed':''}`}><span/>{saved}</span><button className="icon-button help-button" aria-label="사용 안내" onClick={()=>setHelp(true)}><CircleHelp size={19}/></button><button className="primary compact" aria-expanded={exportOpen} onClick={()=>{setExportOpen(v=>!v);requestAnimationFrame(()=>exportRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'}));}}><Download size={15}/> 내보내기 <ChevronDown size={13}/></button></div>
    </header>
    <div className="workspace">
      <aside className="left-panel">
        <button className="editor-back" disabled={leaving||busy} onClick={()=>void leave()}><ChevronLeft size={16}/> 작업실로 돌아가기</button><div className="panel-heading"><div><span className="eyebrow">YOUR LITTLE PUBLISHING STUDIO</span><h1>하나의 장면, 한 편의 글.</h1></div><Leaf size={24} strokeWidth={1.2}/></div>
        <div className="tabs" role="tablist" aria-label="편집 메뉴"><button role="tab" aria-selected={tab==='content'} className={tab==='content'?'active':''} onClick={()=>setTab('content')}><FileText size={15}/> 콘텐츠</button><button role="tab" aria-selected={tab==='design'} className={tab==='design'?'active':''} onClick={()=>setTab('design')}><Layers size={15}/> 템플릿 & 스타일</button></div>
        <div className="left-scroll">
          {tab==='content'?<>
            <section className="form-section">
              <div className="section-label"><span>01</span><h2>사진</h2><span className="section-note">원본 색감 그대로</span></div>
              <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="사진 파일 업로드" className="sr-only" onChange={(e:ChangeEvent<HTMLInputElement>)=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
              <div className={`upload-zone ${dragOver?'drag-over':''}`} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);void upload(e.dataTransfer.files[0]);}}>
                <button className="photo-upload" onClick={()=>uploadRef.current?.click()}>{project.photo?<img src={project.photo} alt="현재 업로드한 원본 사진"/>:<span className="upload-empty"><ImagePlus size={30}/> 사진을 추가해 주세요</span>}<span className="photo-upload-label"><ImagePlus size={17}/> {project.photo?'사진 변경':'사진 추가'}</span></button>
                <div className="photo-file"><span title={project.photoName}>{project.photoName||'아직 선택한 사진이 없어요'}</span><small>{project.photo?`${project.photoWidth.toLocaleString()} × ${project.photoHeight.toLocaleString()} px`:'JPG · PNG · WebP'}</small><button onClick={()=>uploadRef.current?.click()} aria-label="새 사진 선택"><Upload size={14}/></button></div>
              </div>
              <p className="hint">사진을 끌어 놓거나 클릭하여 업로드 · JPG, PNG, WebP</p>
            </section>
            <section className="form-section">
              <div className="section-label"><span>02</span><h2>작품 정보</h2></div>
              <div className="title-fields"><Field label="작품 번호">{textInput('number','007',12)}</Field><Field label="제목">{textInput('title','어떤 장면을 기록할까요?',60)}</Field></div>
              <Field label="부제 · 선택">{textInput('subtitle','제목 곁에 놓을 짧은 문장',80)}</Field>
              <details className="metadata"><summary>촬영 정보 <ChevronDown size={13}/><span>연도 · 장소 · 카메라</span></summary><div className="two-fields"><Field label="촬영 연도">{textInput('year','2026',10)}</Field><Field label="장소">{textInput('location','장소',50)}</Field></div><Field label="카메라">{textInput('camera','카메라',80)}</Field><Field label="필름">{textInput('film','필름',80)}</Field><Field label="작품 설명">{textInput('description','사진에 덧붙일 기록',140)}</Field></details>
            </section>
            <section className="form-section body-section">
              <div className="section-label"><span>03</span><h2>문장</h2><span className="section-note">{project.body.length.toLocaleString()} 자</span></div>
              <textarea ref={bodyRef} className="body-input" aria-label="본문" placeholder="이 장면에 담긴 이야기를 적어보세요.\n\n줄바꿈과 빈 줄도 그대로 담아드려요." value={project.body} onChange={e=>patch({body:e.target.value,pageOrder:[]})}/>
              <div className="body-tools"><span><Sparkles size={12}/> 분량에 맞춰 자동 페이지 나눔</span><button onClick={addBreak}><Plus size={12}/> 페이지 나누기</button></div>
              {project.pageOrder.length>0 && <p className="hint">본문을 수정하면 읽는 순서에 맞춰 페이지 순서가 초기화됩니다.</p>}
            </section>
            <section className="form-section author-section"><Field label="기록하는 사람">{textInput('handle','@your_account',60)}</Field><Toggle label="계정명 표시" value={project.showHandle} onChange={v=>patch({showHandle:v})}/></section>
          </>:<>
            <section className="form-section template-section"><div className="section-label"><h2>당신의 기록에 어울리는 모양</h2></div><p className="muted small">템플릿을 바꿔도 사진과 글은 그대로예요.</p>
              {templates.map((t,i)=><button key={t.id} className={`template-card ${project.template===t.id?'selected':''}`} onClick={()=>patch({template:t.id})}>
                <div className={`template-mini mini-${t.id}`}><span>{project.number?(i===0?project.number:`FW / ${project.number}`):'FRAME'}</span>{project.photo&&<img src={project.photo} alt=""/>}<b>{project.title||'사진과 문장'}</b><small>{project.showHandle?project.handle:''}</small></div>
                <div className="template-copy"><span className="template-tag">{t.tag}</span><strong>{t.name}</strong><p>{t.description}</p></div><span className="radio-circle">{project.template===t.id&&<Check size={12}/>}</span>
              </button>)}
            </section>
            <Typography project={project} onChange={patch}/><section className="form-section"><div className="section-label"><Settings2 size={15}/><h2>본문 기본 스타일</h2></div><Range label="글자 크기" value={project.fontSize} min={28} max={48} suffix=" px" onChange={v=>patch({fontSize:v})}/><Range label="줄 간격" value={project.lineHeight} min={1.3} max={2} step={.05} onChange={v=>patch({lineHeight:v})}/><Range label="좌우 여백" value={project.margin} min={48} max={140} suffix=" px" onChange={v=>patch({margin:v})}/><Toggle label="본문 페이지에 제목 표시" value={project.showTitle} onChange={v=>patch({showTitle:v})}/><Toggle label="작품 번호 표시" value={project.showNumber} onChange={v=>patch({showNumber:v})}/><Field label="본문 세로 정렬"><select value={project.textAlign} onChange={e=>patch({textAlign:e.target.value as 'top'|'center'})}><option value="top">위쪽 정렬</option><option value="center">가운데 정렬</option></select></Field><p className="hint">글자를 줄이지 않고 다음 페이지로 이어집니다. 페이지별 설정이 있으면 그 설정을 우선합니다.</p></section>
            <section className="form-section"><div className="section-label"><h2>기존 게시물 살펴보기</h2></div><p className="muted small">PDF 예시를 새 프로젝트로 엽니다. 현재 작업은 유지돼요.</p><div className="examples">{['꿈','이상은 이상','기억력'].map((title,i)=><button key={title} disabled={leaving||busy} onClick={()=>void leave(i)}>{title}<ArrowRight size={13}/></button>)}</div></section>
          </>}
          <div className="local-note"><ShieldCheck size={15}/><span>사진과 글은 이 브라우저에만 저장돼요.<br/>외부 서버로 전송하지 않습니다.</span></div>
        </div>
      </aside>
      <main className="center-panel">
        <div className="canvas-toolbar"><div className="breadcrumb"><span className="green-dot"/> LIVE PREVIEW <i>/</i><span>{kindNames[current.kind]}</span></div><div className="canvas-controls"><span>4:5</span><button className="icon-button" onClick={()=>setFocusPreview(v=>!v)} aria-label={focusPreview?'편집기로 돌아가기':'미리보기 크게 보기'}>{focusPreview?<PanelLeftClose size={16}/>:<Expand size={16}/>}</button></div></div>
        <div ref={previewRef} className="preview-viewport"><div className="preview-stage">
          <div className="preview-kicker"><span>{template.name}</span><span>NO. {project.number||'—'}</span></div>
          <div className={`canvas-shell ${current.kind==='cover'?'draggable':''}`} style={{width:`min(calc(var(--preview-base) * ${zoom/100}), 100%)`}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
            {fontReady&&(image||current.kind==='text')?<PageCanvas project={project} page={current} image={image} onError={setError}/>:<div className="canvas-loading">{project.photo?<><LoaderCircle className="spin" size={22}/><span>사진과 글꼴을 준비하는 중</span></>:<><ImagePlus size={42} strokeWidth={1}/><strong>당신의 장면을 기다리고 있어요.</strong><span>사진을 추가하면 게시물이 만들어집니다.</span><button className="primary" onClick={()=>uploadRef.current?.click()}>사진 추가하기</button></>}</div>}
          </div>
          <div className="preview-caption"><span>{String(currentIndex+1).padStart(2,'0')}</span><span className="caption-line"/><span>{kindNames[current.kind]}</span>{current.kind==='cover'&&<small>사진을 드래그해 구도를 맞춰보세요</small>}</div>
        </div>
        </div><div className="zoom-bar"><button className="icon-button" aria-label="미리보기 축소" onClick={()=>setZoom(z=>Math.max(20,z-10))}><Minus size={14}/></button><button className="zoom-value" onClick={()=>setZoom(100)}>{zoom}%</button><button className="icon-button" aria-label="미리보기 확대" onClick={()=>setZoom(z=>Math.min(200,z+10))}><Plus size={14}/></button><span/><button className="icon-button" aria-label="화면에 맞춤" onClick={fitPreview}><Maximize2 size={13}/><span>화면에 맞춤</span></button></div>
        <section className="filmstrip"><div className="filmstrip-header"><h2>페이지 <span>{pages.length}</span></h2><span>사진에서 문장으로, 하나의 이야기</span><button onClick={()=>{setTab('content');bodyRef.current?.focus();}} title="본문 편집으로 이동"><FileText size={13}/> 본문 편집</button></div><div className="thumbnail-list">
          {pages.map((page,i)=><button key={page.id} className={`thumbnail ${current.id===page.id?'active':''}`} onClick={()=>setSelected(page.id)} aria-label={`${i+1}페이지 ${kindNames[page.kind]}`}><div className="thumb-art">{fontReady&&<PageCanvas project={project} page={page} image={image} thumbnail onError={setError}/>}<span className="thumb-number">{String(i+1).padStart(2,'0')}</span>{current.id===page.id&&<span className="thumb-check"><Check size={10}/></span>}</div><span className="thumb-label">{kindNames[page.kind]}{page.kind==='text'?` ${pages.slice(0,i+1).filter(p=>p.kind==='text').length}`:''}</span></button>)}
        </div></section>
      </main>
      <aside className={`right-panel ${exportOpen?'mobile-open':''}`}>
        <div className="right-heading"><SlidersHorizontal size={15}/><h2>페이지 설정</h2><button className="icon-button mobile-close" onClick={()=>setExportOpen(false)} aria-label="내보내기 패널 닫기"><X size={16}/></button></div>
        <div className="page-identity"><span className="page-icon">{current.kind==='text'?<Type size={19}/>:<ImagePlus size={19}/>}</span><div><strong>{kindNames[current.kind]}</strong><span>PAGE {String(currentIndex+1).padStart(2,'0')} OF {String(pages.length).padStart(2,'0')}</span></div><div className="page-nav"><button className="icon-button" disabled={currentIndex===0} onClick={()=>setSelected(pages[currentIndex-1].id)} aria-label="이전 페이지"><ChevronLeft size={14}/></button><button className="icon-button" disabled={currentIndex===pages.length-1} onClick={()=>setSelected(pages[currentIndex+1].id)} aria-label="다음 페이지"><ChevronRight size={14}/></button></div></div>
        <div className="right-scroll">
          {current.kind==='cover'?<section className="right-section"><h3>사진 구도</h3><Range label="사진 확대" value={project.crop.zoom} min={1} max={3} step={.05} suffix="×" onChange={v=>patch({crop:{...project.crop,zoom:v}})}/><Range label="가로 위치" value={project.crop.x} min={0} max={1} step={.01} onChange={v=>patch({crop:{...project.crop,x:v}})}/><Range label="세로 위치" value={project.crop.y} min={0} max={1} step={.01} onChange={v=>patch({crop:{...project.crop,y:v}})}/><button className="text-button" onClick={()=>patch({crop:{x:.5,y:.5,zoom:1}})}><RotateCcw size={12}/> 구도 초기화</button>{project.template==='original'&&<><div className="subtle-divider"/><h3>제목 가독성</h3><Range label="하단 그라디언트" value={project.gradient*100} min={0} max={90} suffix="%" onChange={v=>patch({gradient:v/100})}/><p className="hint">표지 아래쪽에만 적용됩니다.<br/>0%로 설정하면 완전히 해제돼요.</p></>}</section>:current.kind==='text'?<section className="right-section"><h3>이 본문 페이지</h3><button className="text-button" onClick={editCurrentText}><FileText size={12}/> 원문에서 이 페이지 수정</button><Range label="이 페이지 글자 크기" value={current.style.fontSize} min={28} max={48} suffix=" px" onChange={v=>setPageStyle({fontSize:v})}/><Range label="이 페이지 여백" value={current.style.margin} min={48} max={140} suffix=" px" onChange={v=>setPageStyle({margin:v})}/><Toggle label="제목 표시" value={current.style.showTitle} onChange={v=>setPageStyle({showTitle:v})}/><Field label="세로 정렬"><select value={current.style.align} onChange={e=>setPageStyle({align:e.target.value as 'top'|'center'})}><option value="top">위쪽</option><option value="center">가운데</option></select></Field><p className="hint">글상자가 바뀌면 남은 글은 다음 페이지로 이어집니다. 원문은 유지됩니다.</p><button className="text-button" onClick={()=>{const styles={...project.pageStyles};delete styles[current.id];patch({pageStyles:styles});}}><RotateCcw size={12}/> 기본 스타일로 복원</button></section>:<section className="right-section"><h3>있는 그대로의 사진</h3><p className="muted small spaced">사진의 원래 비율을 유지해<br/>여백 안에 배치합니다.</p><div className="info-chip"><Check size={12}/> 색 보정 없음 · 필터 없음</div><button className="text-button" onClick={()=>{setTab('content');document.querySelector('.metadata')?.setAttribute('open','');}}><FileText size={12}/> 촬영 정보 수정</button></section>}
          <section className="right-section order-section"><div><h3>페이지 순서</h3><span className="small muted">선택한 페이지 이동</span></div><button className="icon-button bordered" disabled={currentIndex===0} onClick={()=>reorder(-1)} aria-label="페이지 앞으로 이동"><ArrowUp size={14}/></button><button className="icon-button bordered" disabled={currentIndex===pages.length-1} onClick={()=>reorder(1)} aria-label="페이지 뒤로 이동"><ArrowDown size={14}/></button></section>
          <section ref={exportRef} className="right-section export-section"><div className="export-title"><Download size={16}/><h3>기록 내보내기</h3></div><p className="muted small">인스타그램에 바로 올릴 수 있도록.</p><Field label="PNG 해상도"><select value={resolution} onChange={e=>setResolution(+e.target.value)}><option value={1}>1080 × 1350 · 기본</option><option value={2}>2160 × 2700 · 고해상도</option></select></Field><div className="export-spec"><span>파일 형식 <b>PNG</b></span><span>화면 비율 <b>4:5</b></span><span>전체 페이지 <b>{pages.length}장</b></span></div>
          {(lowResolution||lowEffectiveResolution)&&<p className="resolution-warning">선택한 크기에서는 사진이 확대되어 선명도가 낮아질 수 있어요. 원본 디테일을 추가하지 않습니다.</p>}
          <button className="primary full" disabled={!ready||busy} onClick={()=>void doExport(true)}>{busy?<LoaderCircle className="spin" size={15}/>:<Download size={15}/>} 전체 다운로드 <span>ZIP</span></button><button className="secondary full" disabled={!ready||busy} onClick={()=>void doExport(false)}>현재 페이지 다운로드 <ArrowDown size={14}/></button><p className="export-footnote">{busy?progress:'사진의 색을 바꾸지 않고 저장합니다.'}</p></section>
          <div className="studio-note"><span>MADE TO REMEMBER.</span><p>흘러가는 장면을 붙잡고,<br/>그 곁에 당신의 문장을 놓으세요.</p><span className="note-star">✳</span></div>
        </div>
      </aside>
    </div>
    <footer className="statusbar"><span><ShieldCheck size={12}/> 나만의 로컬 작업실</span><span>필터 없이, 당신의 시선 그대로.</span><span>FRAME & WORDS <i>© 2026</i></span></footer>
    {error&&<div className="toast error" role="alert"><span>{error}</span><button aria-label="오류 닫기" onClick={()=>setError('')}><X size={16}/></button></div>}
    {notice&&<div className="toast" role="status"><Check size={16}/><span>{notice}</span><button aria-label="알림 닫기" onClick={()=>setNotice('')}><X size={14}/></button></div>}
    {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><section role="dialog" aria-modal="true" aria-label="사용 안내" className="help-modal" onClick={e=>e.stopPropagation()}><button className="icon-button modal-close" aria-label="안내 닫기" onClick={()=>setHelp(false)}><X size={19}/></button><span className="eyebrow">A SMALL GUIDE</span><h2>장면을 담고, 문장을 놓으세요.</h2><ol><li><b>사진과 글을 더하세요.</b><p>사진은 외부로 전송되지 않아요. 제목과 본문, 촬영 정보를 자유롭게 수정하세요.</p></li><li><b>페이지를 다듬으세요.</b><p>본문은 자동으로 나뉩니다. 원하는 위치에 커서를 두고 ‘페이지 나누기’를 누르거나, 별도 줄에 <code>---page---</code>를 입력하세요. 빈 본문은 사진 2장만 만듭니다.</p></li><li><b>당신의 스타일을 고르세요.</b><p>세 가지 템플릿, 표지 드래그 크롭, 페이지별 본문 스타일과 순서를 조절할 수 있어요.</p></li><li><b>PNG로 간직하세요.</b><p>현재 페이지를 PNG로, 전체를 순서대로 담은 ZIP으로 저장하세요. 출력은 sRGB 픽셀 렌더링이며 원본 파일·EXIF·ICC를 보존하는 것은 아니에요.</p></li></ol><p className="help-caution">여러 프로젝트를 이 브라우저에 자동 저장합니다. 상단 작업실에서 만들고 다시 열 수 있어요. 사이트 데이터를 지우면 작업도 사라지므로 원본 사진은 별도로 보관해 주세요.</p><button className="primary full" onClick={()=>setHelp(false)}>기록 시작하기 <ArrowRight size={15}/></button></section></div>}
    {busy&&<div className="export-progress" role="status"><LoaderCircle className="spin" size={16}/><span>{progress||'글꼴과 사진을 확인하는 중'}</span></div>}
  </div>;
}
