import type { Page as BrowserPage } from '@playwright/test';
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function openProject(page:BrowserPage){
  await page.goto('/');
  await page.getByRole('button',{name:'새 프로젝트',exact:true}).click();
  await page.getByLabel('제목',{exact:true}).fill('테스트 프로젝트');
  await page.getByLabel('작품 번호',{exact:true}).fill('005');
  await page.getByRole('textbox',{name:'본문',exact:true}).fill('테스트용 본문입니다.\n\n원문 그대로 보관합니다.');
  await page.locator('.metadata summary').click();
  await page.getByLabel('촬영 연도',{exact:true}).fill('2025');
  await page.getByLabel('장소',{exact:true}).fill('테스트 장소');
  await page.getByLabel('카메라',{exact:true}).fill('카메라');
  await page.getByLabel('필름',{exact:true}).fill('필름');
  await page.getByLabel('사진 파일 업로드').setInputFiles(resolve('tests/fixtures/photo.png'));
}

test('upload, edit, crop, switch templates, persist and export full resolution PNG/ZIP',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await openProject(page);
  const all=page.getByRole('button',{name:'전체 다운로드 ZIP'});
  await expect(all).toBeEnabled({timeout:60_000});
  await page.screenshot({path:testInfo.outputPath('editor-original.png'),fullPage:true});
  await page.getByLabel('사진 파일 업로드').setInputFiles(resolve('tests/fixtures/photo.png'));
  await expect(page.getByRole('status').filter({hasText:'사진을 불러왔습니다'})).toBeVisible();
  await page.getByLabel('제목',{exact:true}).fill('빛이 머무는 자리');
  await page.getByLabel('부제 · 선택').fill('아주 작은 기록');
  const body='한글과 English, “인용” 그리고 理想.\n\n빈 문단을 그대로 남깁니다.\n---page---\n'+('사진을 보고 마음에 남은 것을 적는다.\n\n'.repeat(12));
  await page.getByRole('textbox',{name:'본문',exact:true}).fill(body);
  await expect(all).toBeEnabled();
  const originalThumbCount=await page.locator('.thumbnail').count();
  expect(originalThumbCount).toBeGreaterThan(4);
  await page.getByLabel('사진 확대',{exact:true}).fill('1.5');
  const canvas=page.locator('.canvas-shell');
  const box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.6);await page.mouse.up();
  await expect(page.getByLabel('가로 위치')).not.toHaveValue('0.5');
  await page.getByRole('tab',{name:'템플릿 & 스타일'}).click();
  await page.getByRole('button',{name:/추천 Editorial Journal/}).click();
  await expect(page.locator('.preview-kicker')).toContainText('Editorial Journal');
  await expect(all).toBeEnabled();
  await page.screenshot({path:testInfo.outputPath('editor-editorial.png'),fullPage:true});
  await page.getByRole('button',{name:/새로운 시선 Film Archive/}).click();
  await expect(page.locator('.preview-kicker')).toContainText('Film Archive');
  await page.screenshot({path:testInfo.outputPath('editor-film.png'),fullPage:true});
  await page.getByRole('button',{name:/사진 중심 Original Archive/}).click();
  await page.getByRole('tab',{name:'콘텐츠',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'본문',exact:true})).toHaveValue(body);
  // Photo pages use unmodified image pixels; cover-only gradient does not affect them.
  await page.locator('.thumbnail').nth(1).click();
  await expect(page.locator('.preview-caption')).toContainText('사진 · 정보');
  const pixel=await page.locator('.canvas-shell canvas').evaluate(async(node)=>{
    const canvas=node as HTMLCanvasElement;
    const photo=new Image();photo.src=document.querySelector<HTMLImageElement>('.photo-upload img')!.src;await photo.decode();
    const source=document.createElement('canvas');source.width=photo.naturalWidth;source.height=photo.naturalHeight;
    const ctx=source.getContext('2d')!;ctx.drawImage(photo,0,0);
    return {actual:Array.from(canvas.getContext('2d')!.getImageData(540,626,1,1).data),original:Array.from(ctx.getImageData(Math.floor(photo.naturalWidth/2),Math.floor(photo.naturalHeight/2),1,1).data)};
  });
  pixel.actual.forEach((v,i)=>expect(Math.abs(v-pixel.original[i])).toBeLessThan(12));
  // A page reordering must control preview and ZIP filenames consistently.
  await page.getByRole('button',{name:'페이지 앞으로 이동'}).click();
  await expect(page.locator('.thumbnail').first()).toHaveAttribute('aria-label','1페이지 사진 · 정보');
  await expect(page.getByText('브라우저에 저장됨',{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'빛이 머무는 자리 열기',exact:true}).click();
  await expect(all).toBeEnabled();
  await expect(page.getByLabel('제목',{exact:true})).toHaveValue('빛이 머무는 자리');
  await expect(page.getByRole('textbox',{name:'본문',exact:true})).toHaveValue(body);
  await expect(page.locator('.thumbnail').first()).toHaveAttribute('aria-label','1페이지 사진 · 정보');
  // Default PNG, exact dimensions from IHDR.
  const preview=await page.locator('.canvas-shell canvas').evaluate(el=>(el as HTMLCanvasElement).toDataURL('image/png'));
  const firstDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'현재 페이지 다운로드'}).click();
  const first=await firstDownload;
  expect(first.suggestedFilename()).toContain('_02_cover.png');
  const png=await readFile((await first.path())!);
  await writeFile(testInfo.outputPath('preview.png'),Buffer.from(preview.split(',')[1],'base64'));
  await writeFile(testInfo.outputPath('export.png'),png);
  const pixelDiff=await page.evaluate(async({preview,exported})=>{
    const decode=async(src:string)=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
    const a=await decode(preview),b=await decode(exported);
    let difference=0,max=0,minX=1080,minY=1350,maxX=0,maxY=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i]){difference++;max=Math.max(max,Math.abs(a[i]-b[i]));const pixel=Math.floor(i/4);minX=Math.min(minX,pixel%1080);maxX=Math.max(maxX,pixel%1080);minY=Math.min(minY,Math.floor(pixel/1080));maxY=Math.max(maxY,Math.floor(pixel/1080));}
    return {difference,max,minX,minY,maxX,maxY};
  },{preview,exported:`data:image/png;base64,${png.toString('base64')}`});
  expect(pixelDiff).toEqual(expect.objectContaining({difference:0}));
  expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(1350);
  await page.getByLabel('PNG 해상도').selectOption('2');
  await page.locator('.thumbnail').nth(2).click();
  const highDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'현재 페이지 다운로드'}).click();
  const high=await highDownload;const highPng=await readFile((await high.path())!);
  expect(highPng.readUInt32BE(16)).toBe(2160);expect(highPng.readUInt32BE(20)).toBe(2700);
  await page.getByLabel('PNG 해상도').selectOption('1');
  const zipDownload=page.waitForEvent('download');await all.click();const zipFile=await zipDownload;
  const zip=await JSZip.loadAsync(await readFile((await zipFile.path())!));
  const names=Object.keys(zip.files);
  expect(names).toHaveLength(originalThumbCount);
  expect(names[0]).toContain('_01_photo.png');expect(names[1]).toContain('_02_cover.png');
  for(const name of names){const bytes=await zip.file(name)!.async('nodebuffer');expect(bytes.readUInt32BE(16)).toBe(1080);expect(bytes.readUInt32BE(20)).toBe(1350);}
  expect(errors).toEqual([]);
});

test('page controls reflow, manual breaks, blank body, validation and mobile layout',async({page},testInfo)=>{
  await openProject(page);await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeEnabled({timeout:60_000});
  const body=page.getByRole('textbox',{name:'본문',exact:true});
  await body.fill('첫 페이지입니다.\n둘째 문장입니다.');
  await body.evaluate((el:HTMLTextAreaElement)=>{el.focus();el.setSelectionRange(10,10);});
  await page.getByRole('button',{name:'페이지 나누기',exact:true}).click();
  await expect(body).toHaveValue(/---page---/);
  await expect(page.locator('.thumbnail')).toHaveCount(4);
  await page.locator('.thumbnail').nth(2).click();
  await page.getByLabel('이 페이지 글자 크기').fill('48');
  await page.getByLabel('이 페이지 여백').fill('140');
  await expect(body).toHaveValue(/첫 페이지입니다/);
  await body.fill('');await expect(page.locator('.thumbnail')).toHaveCount(2);
  await page.getByLabel('사진 파일 업로드').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await expect(page.getByRole('alert')).toContainText('사진을 읽을 수 없습니다');
  await page.getByRole('button',{name:'오류 닫기'}).click();
  await page.getByLabel('사진 파일 업로드').setInputFiles({name:'photo.heic',mimeType:'image/heic',buffer:Buffer.from('heic')});
  await expect(page.getByRole('alert')).toContainText('HEIC');
  await page.getByRole('button',{name:'오류 닫기'}).click();
  const transparent=await page.evaluate(()=>document.createElement('canvas').toDataURL('image/png').split(',')[1]);
  await page.getByLabel('사진 파일 업로드').setInputFiles({name:'empty.png',mimeType:'image/png',buffer:Buffer.from(transparent,'base64')});
  await expect(page.getByRole('alert')).toContainText('완전히 투명한 이미지');
  await page.getByRole('button',{name:'오류 닫기'}).click();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.canvas-shell')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button',{name:'내보내기',exact:true}).click();
  await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
});

test('all templates keep maximum-length titles and metadata inside the canvas, with one handle per page',async({page})=>{
  await openProject(page);await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeEnabled({timeout:60_000});
  const photoSource=await page.locator('.photo-upload img').getAttribute('src');
  const result=await page.evaluate(async(photoSource)=>{
    const renderPath='/src/lib/render.ts', defaultPath='/src/defaults.ts',paginationPath='/src/lib/pagination.ts', mediaPath='/src/lib/media.ts';
    const {renderPage,coverBox}=await import(renderPath);
    const {blankProject}=await import(defaultPath);
    const {paginate}=await import(paginationPath);
    const {ensureFonts,loadImage}=await import(mediaPath);
    const p=blankProject();p.photo=photoSource;p.handle='@author';
    p.title='가'.repeat(60);p.subtitle='나'.repeat(80);p.year='2'.repeat(10);p.location='다'.repeat(50);p.camera='라'.repeat(80);p.film='마'.repeat(80);p.description='바'.repeat(140);p.body=('한국어 English 理想과 “인용” — 👨‍👩‍👧‍👦\n\n').repeat(20);
    await ensureFonts([p.title,p.subtitle,p.year,p.location,p.camera,p.film,p.description,p.body].join(''));
    const image=await loadImage(p.photo);
    const canvas=document.createElement('canvas');
    const measureCanvas=document.createElement('canvas').getContext('2d')!;
    const pages=paginate(p,(size:number)=>{measureCanvas.font=`400 ${size}px "Noto Sans KR"`;return (text:string)=>measureCanvas.measureText(text).width;});
    const records:{template:string;kind:string;text:string;x:number;y:number;right:number;bottom:number}[]=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    let template='',kind='';
    CanvasRenderingContext2D.prototype.fillText=function(text:string,x:number,y:number,maxWidth?:number){
      const metrics=this.measureText(text);
      const width=Math.min(metrics.width,maxWidth??Infinity);
      const left=this.textAlign==='right'?x-width:this.textAlign==='center'?x-width/2:x;
      if(text.trim())records.push({template,kind,text,x:left,y,right:left+width,bottom:y+metrics.actualBoundingBoxDescent});
      if(maxWidth===undefined)original.call(this,text,x,y);else original.call(this,text,x,y,maxWidth);
    };
    try{
      for(const t of ['original','editorial','film']){
        template=t;p.template=t;
        for(const current of pages){kind=current.id;renderPage(canvas,p,current,image);}
        p.title='가'.repeat(20);p.subtitle='나'.repeat(60);kind='cover-wide-title';renderPage(canvas,p,pages[0],image);
        const photo=coverBox(p);
        if(t!=='original'){const title=records.find(r=>r.template===t&&r.kind==='cover-wide-title'&&r.text.startsWith('가'));if(!title||title.y<photo.y+photo.h)throw new Error('Cover title overlaps photo');}
        p.title='가'.repeat(60);p.subtitle='나'.repeat(80);
      }
    }finally{CanvasRenderingContext2D.prototype.fillText=original;}
    return {records,pageCount:pages.length,handle:p.handle};
  },photoSource);
  for(const record of result.records){
    expect(record.x,JSON.stringify(record)).toBeGreaterThanOrEqual(-1);
    expect(record.right,JSON.stringify(record)).toBeLessThanOrEqual(1081);
    expect(record.y,JSON.stringify(record)).toBeGreaterThanOrEqual(0);
    expect(record.bottom,JSON.stringify(record)).toBeLessThan(1350);
  }
  expect(result.records.filter(r=>r.text===result.handle)).toHaveLength(result.pageCount*3+3);
});

test('reports missing fonts and blocks export instead of using fallback text',async({page})=>{
  await page.route(/\.woff2?(\?.*)?$/,route=>route.abort('failed'));
  await openProject(page);
  await expect(page.getByRole('alert')).toContainText('글꼴을 불러오지 못했습니다',{timeout:30_000});
  await expect(page.getByRole('button',{name:'전체 다운로드 ZIP'})).toBeDisabled();
});
