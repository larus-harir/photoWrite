import { useCallback, useEffect, useState } from 'react';
import { Copy, FolderOpen, ImagePlus, LoaderCircle, Maximize2, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import App from './App';
import { blankProject } from './defaults';
import type { Project } from './types';
import { templates } from './types';
import { deleteProject, loadProjects, saveProject } from './lib/storage';

export default function Studio() {
  const [projects,setProjects]=useState<Project[]>([]);
  const [active,setActive]=useState<Project|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [creating,setCreating]=useState(false);
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState('recent');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let live=true;
    setLoading(true);
    loadProjects().then(p=>{if(live){setProjects(p);setError('');}})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:'작업실을 불러오지 못했습니다. 사이트 저장 공간을 허용해 주세요.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[attempt]);
  const remember=useCallback((p:Project)=>setProjects(list=>[p,...list.filter(item=>item.id!==p.id)]),[]);
  async function create(p:Project) {
    setCreating(true);setError('');
    try{const saved=await saveProject(p);remember(saved);setActive(saved);}
    catch{setError('프로젝트를 저장하지 못했습니다. 브라우저의 저장 공간을 확인해 주세요.');}
    finally{setCreating(false);}
  }
  async function remove(p:Project) {
    if(!window.confirm(`‘${p.title||'제목 없는 기록'}’을 삭제할까요? 이 브라우저에서 영구 삭제됩니다.`))return;
    try{await deleteProject(p.id);setProjects(list=>list.filter(item=>item.id!==p.id));}
    catch{setError('삭제하지 못했습니다. 다시 시도해 주세요.');}
  }
  async function duplicate(p:Project) {
    await create({...p,id:crypto.randomUUID(),title:`${p.title||'제목 없는 기록'}의 사본`.slice(0,60),createdAt:Date.now(),updatedAt:Date.now()});
  }
  if(active)return <App key={active.id} initialProject={active} onSaved={remember} onBack={()=>setActive(null)}/>;
  const visible=projects.filter(p=>[p.title,p.subtitle,p.location].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a,b)=>sort==='title'?(a.title||'제목 없는 기록').localeCompare(b.title||'제목 없는 기록','ko'):b.updatedAt-a.updatedAt);
  return <div className="studio-app">
    <header className="topbar"><a href="#" className="brand" aria-label="Frame and Words 홈"><span className="brand-icon"><Maximize2 size={21}/></span><span>FRAME <i>&</i> WORDS<small>사진과 문장 사이</small></span></a><span className="studio-header-label">나의 작업실</span><div className="top-actions"><span className="studio-local"><ShieldCheck size={15}/> 이 브라우저에 저장</span><button className="primary" onClick={()=>void create(blankProject())} disabled={loading||creating}><Plus size={17}/> 새 프로젝트</button></div></header>
    <main className="studio-main">
      <section className="studio-intro"><div><span className="eyebrow">YOUR PERSONAL ARCHIVE</span><h1>나의 작업실<span>.</span></h1><p>사진 한 장에서 시작해, 당신만의 이야기로.</p></div><div className="studio-count"><strong>{projects.length.toString().padStart(2,'0')}</strong><span>개의 기록</span></div></section>
      <div className="studio-listbar"><h2><FolderOpen size={18}/> 프로젝트 <span>{projects.length}</span></h2><label className="studio-search"><Search size={16}/><input aria-label="프로젝트 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="제목, 부제, 장소로 검색"/></label><label className="studio-sort"><span className="sr-only">프로젝트 정렬</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">최근 수정순</option><option value="title">제목순</option></select></label></div>
      {error&&<div role="alert" className="studio-error">{error}<button onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></div>}
      {loading?<div className="studio-empty"><LoaderCircle className="spin"/><p>기록을 불러오는 중입니다.</p></div>:projects.length===0?<section className="studio-empty"><div className="empty-illustration"><ImagePlus size={42} strokeWidth={1}/><span>사진 + 문장</span></div><h2>아직 쓰이지 않은 이야기</h2><p>사진과 글을 더해 첫 기록을 만들어 보세요.<br/>새 프로젝트는 빈 페이지에서 시작합니다.</p><button className="primary" disabled={creating} onClick={()=>void create(blankProject())}><Plus size={17}/> 첫 프로젝트 만들기</button></section>:visible.length===0?<div className="studio-empty"><Search size={28}/><h2>일치하는 기록이 없어요.</h2><button className="secondary" onClick={()=>setQuery('')}>검색 지우기</button></div>:<div className="project-grid">{visible.map(p=><article className="project-card" key={p.id}>
        <button className="project-open" onClick={()=>setActive(p)} aria-label={`${p.title||'제목 없는 기록'} 열기`}><div className="project-art">{p.photo?<img src={p.photo} alt=""/>:<div className="project-no-photo"><ImagePlus size={32} strokeWidth={1}/><span>사진을 기다리는 기록</span></div>}<span className="project-template">{templates.find(t=>t.id===p.template)?.name}</span></div><div className="project-copy"><span>{p.number?`NO. ${p.number}`:'UNTITLED RECORD'}</span><h3>{p.title||'제목 없는 기록'}</h3><p>{p.subtitle||p.location||'당신의 이야기를 더해 주세요.'}</p></div></button><div className="project-card-footer"><time dateTime={new Date(p.updatedAt).toISOString()}>{new Intl.DateTimeFormat('ko',{month:'long',day:'numeric'}).format(p.updatedAt)} 수정</time><button className="icon-button" aria-label={`${p.title||'제목 없는 기록'} 복제`} disabled={creating} onClick={()=>void duplicate(p)}><Copy size={15}/></button><button className="icon-button" aria-label={`${p.title||'제목 없는 기록'} 삭제`} onClick={()=>void remove(p)}><Trash2 size={15}/></button></div>
      </article>)}</div>}
      <p className="studio-storage-note"><ShieldCheck size={16}/> 작업은 이 브라우저에 자동 저장됩니다. 다른 기기와 동기화되지 않으며, 사이트 데이터를 지우면 삭제됩니다. 원본 사진과 완성 PNG는 별도로 보관하세요.</p>
    </main>
    <footer className="studio-footer"><span>FRAME & WORDS</span><p>흘러가는 장면을 붙잡고, 그 곁에 당신의 문장을.</p></footer>

  </div>;
}
