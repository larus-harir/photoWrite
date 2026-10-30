import type { Project } from './types';

/** A new project contains settings only, never someone else's content. */
export function blankProject(): Project {
  return {
    version:1, id:crypto.randomUUID(), createdAt:Date.now(), updatedAt:Date.now(),
    title:'', subtitle:'', number:'', body:'', year:'', location:'', camera:'', film:'', description:'', handle:'',
    photo:'', photoName:'', photoWidth:0, photoHeight:0,
    titleFont:'noto-sans', bodyFont:'noto-sans', template:'original',
    showNumber:true, showHandle:true, showTitle:true, textAlign:'top',
    crop:{x:.5,y:.5,zoom:1}, gradient:.55, fontSize:36, lineHeight:1.65, margin:64,
    pageStyles:{}, pageOrder:[],
  };
}
export function normalizeProject(project:Project):Project {
  const normalized={...blankProject(),...project};
  // Bundled demo files are no longer shipped. Preserve locally edited text,
  // but show a usable upload state instead of requesting a removed image.
  if(normalized.photo.startsWith('/demo/')) {
    normalized.photo='';normalized.photoName='';normalized.photoWidth=0;normalized.photoHeight=0;
  }
  return normalized;
}
