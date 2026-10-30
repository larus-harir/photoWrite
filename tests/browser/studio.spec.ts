import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

test('blank studio, independent drafts, duplication, deletion and font persistence',async({page},testInfo)=>{
  await page.goto('/');
  await expect(page.getByText('아직 쓰이지 않은 이야기')).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/예시|예제/})).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('studio-empty.png'),fullPage:true});
  await page.getByRole('button',{name:'새 프로젝트',exact:true}).click();
  await expect(page.getByLabel('제목',{exact:true})).toHaveValue('');
  await expect(page.getByRole('textbox',{name:'본문',exact:true})).toHaveValue('');
  await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeDisabled();
  await page.getByLabel('제목',{exact:true}).fill('나의 첫 기록');
  const body=('문장과 공백을 남기는 나의 기록. English 理想 “인용”.\n\n').repeat(25);
  await page.getByRole('textbox',{name:'본문',exact:true}).fill(body);
  await page.getByLabel('사진 파일 업로드').setInputFiles(resolve('tests/fixtures/photo.png'));
  await page.getByRole('tab',{name:'템플릿 & 스타일'}).click();
  await expect(page.getByRole('heading',{name:'기존 게시물 살펴보기'})).toHaveCount(0);
  await expect(page.getByLabel('제목 글꼴',{exact:true})).toHaveValue('noto-sans');
  await expect(page.getByLabel('본문·부제 글꼴')).toHaveValue('noto-sans');
  await page.getByLabel('제목 글꼴',{exact:true}).selectOption('gowun');
  await page.getByLabel('본문·부제 글꼴').selectOption('plex');
  await page.getByLabel('표지 제목 크기',{exact:true}).fill('120');
  await page.getByLabel('본문 페이지 제목 크기',{exact:true}).fill('88');
  await page.getByLabel('부제 크기',{exact:true}).fill('56');
  await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeEnabled();
  await page.getByRole('button',{name:'작업실로 돌아가기',exact:true}).click();
  await expect(page.locator('.project-card')).toHaveCount(1);
  await page.getByRole('button',{name:'새 프로젝트',exact:true}).click();
  await page.getByLabel('제목',{exact:true}).fill('두 번째 기록');
  await page.getByRole('button',{name:'작업실로 돌아가기',exact:true}).click();
  await expect(page.locator('.project-card')).toHaveCount(2);
  await page.getByRole('button',{name:'나의 첫 기록 복제',exact:true}).click();
  await expect(page.getByLabel('제목',{exact:true})).toHaveValue('나의 첫 기록의 사본');
  await page.getByRole('textbox',{name:'본문',exact:true}).fill('사본의 글만 수정합니다.');
  await page.getByRole('button',{name:'작업실로 돌아가기',exact:true}).click();
  await expect(page.locator('.project-card')).toHaveCount(3);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'두 번째 기록 삭제',exact:true}).click();
  await expect(page.locator('.project-card')).toHaveCount(2);
  await page.getByLabel('프로젝트 검색').fill('첫 기록');
  await expect(page.locator('.project-card')).toHaveCount(2);
  await page.getByLabel('프로젝트 검색').fill('');
  await page.screenshot({path:testInfo.outputPath('studio-projects.png'),fullPage:true});
  await page.reload();
  await page.getByRole('button',{name:'나의 첫 기록 열기',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'본문',exact:true})).toHaveValue(body);
  await page.getByRole('tab',{name:'템플릿 & 스타일'}).click();
  await expect(page.getByLabel('제목 글꼴',{exact:true})).toHaveValue('gowun');
  await expect(page.getByLabel('본문·부제 글꼴')).toHaveValue('plex');
  await expect(page.getByLabel('표지 제목 크기',{exact:true})).toHaveValue('120');
  await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeEnabled();
  // Each available font participates in real measurement, preview and PNG export.
  await page.evaluate(()=>{
    const records:{text:string;font:string}[]=[];Reflect.set(window,'__fontRecords',records);
    const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){records.push({text,font:this.font});if(maxWidth===undefined)fill.call(this,text,x,y);else fill.call(this,text,x,y,maxWidth);};
  });
  for(const [id,family] of [['noto-sans','Noto Sans KR'],['noto-serif','Noto Serif KR'],['gowun','Gowun Batang'],['plex','IBM Plex Sans KR']]){
    await page.getByLabel('제목 글꼴',{exact:true}).selectOption(id);
    await page.getByLabel('본문·부제 글꼴').selectOption(id);
    await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeEnabled();
    await page.locator('.thumbnail').nth(2).click();
    await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__fontRecords').filter((r:{text:string})=>r.text.startsWith('문장과')).at(-1)?.font)).toContain(family);
    const imageBefore=await page.locator('.canvas-shell canvas').evaluate(el=>(el as HTMLCanvasElement).toDataURL());
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'현재 페이지 다운로드'}).click();
    const file=await download;expect(await file.failure()).toBeNull();
    const png=await readFile((await file.path())!);
    expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(1350);
    const samePixels=await page.evaluate(async({before,after})=>{
      const pixels=async(src:string)=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(i,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
      const a=await pixels(before),b=await pixels(after);return a.length===b.length&&a.every((v,i)=>v===b[i]);
    },{before:imageBefore,after:`data:image/png;base64,${png.toString('base64')}`});
    expect(samePixels).toBe(true);
  }
  await page.getByRole('button',{name:'기본 글꼴·크기로 복원'}).click();
  await expect(page.getByLabel('제목 글꼴',{exact:true})).toHaveValue('noto-sans');
});

test('atomically migrates a v1 current draft, preserving original image and text',async({page})=>{
  await page.goto('/');
  const legacy=await page.evaluate(async()=>{
    const path='/src/defaults.ts';const{blankProject}=await import(path);const p=blankProject();const c=document.createElement('canvas');c.width=4;c.height=5;const ctx=c.getContext('2d')!;ctx.fillStyle='#778899';ctx.fillRect(0,0,4,5);p.photo=c.toDataURL();p.photoWidth=4;p.photoHeight=5;p.body='이전 버전에서 작성한 글입니다.\n\n공백과 문장도 보존합니다.';
    delete p.id;delete p.createdAt;delete p.updatedAt;delete p.titleFont;delete p.bodyFont;p.title='이전 버전의 내 작업';
    await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('frame-words');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('frame-words',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>{const db=r.result;const t=db.transaction('projects','readwrite');t.objectStore('projects').put(p,'current');t.oncomplete=()=>{db.close();resolve();};};r.onerror=()=>reject(r.error);});
    return {body:p.body,photo:p.photo};
  });
  await page.reload();
  await expect(page.locator('.project-card')).toHaveCount(1);
  await page.getByRole('button',{name:'이전 버전의 내 작업 열기',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'본문',exact:true})).toHaveValue(legacy.body);
  await expect(page.locator('.photo-upload img')).toHaveAttribute('src',legacy.photo);
  await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeEnabled();
  await page.getByRole('button',{name:'작업실로 돌아가기',exact:true}).click();
  await page.reload();await expect(page.locator('.project-card')).toHaveCount(1);
});
