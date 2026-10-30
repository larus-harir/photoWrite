import JSZip from 'jszip';
import type { Page, Project } from '../types';
import { download, ensureFonts, loadImage } from './media';
import { renderPage } from './render';
export function pageFilename(p: Project, page: Page, index: number) {
  const clean = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 70);
  return `${clean(p.number) || '001'}_${clean(p.title) || 'untitled'}_${String(index+1).padStart(2,'0')}_${page.kind}.png`;
}
export function toPNG(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다. 기본 해상도로 다시 시도해 주세요.')), 'image/png'));
}
export async function exportPages(p: Project, pages: Page[], scale: number, all: boolean, progress: (s: string) => void, fullOrder: Page[]) {
  await ensureFonts([p.title,p.subtitle,p.body,p.handle,p.year,p.location,p.camera,p.film,p.description].join(' '));
  const image = await loadImage(p.photo);
  const zip = new JSZip();
  const canvas = document.createElement('canvas');
  try {
    for (let i=0;i<pages.length;i++) {
      progress(`${i+1} / ${pages.length} 페이지 만드는 중`);
      renderPage(canvas, p, pages[i], image, scale);
      const blob = await toPNG(canvas);
      if (blob.size < 100) throw new Error('빈 이미지가 생성되었습니다. 사진을 확인해 주세요.');
      const filename = pageFilename(p,pages[i],fullOrder.findIndex(page => page.id === pages[i].id));
      if (all) zip.file(filename, blob); else download(blob, filename);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (all) {
      progress('ZIP 파일을 정리하는 중');
      const blob = await zip.generateAsync({type:'blob', compression:'STORE'});
      download(blob, `${pageFilename(p, pages[0], 0).split('_01_')[0]}_carousel.zip`);
    }
  } finally { canvas.width = 0; canvas.height = 0; }
}
