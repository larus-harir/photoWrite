import type { Page, Project } from '../types';
import { templates } from '../types';
import { BODY_FONT, HEIGHT, TITLE_FONT, WIDTH, textGeometry, wrapText } from './pagination';

export function coverBox(p: Project) {
  if (p.template === 'editorial') return { x: 68, y: 212, w: 944, h: 760 };
  if (p.template === 'film') return { x: 54, y: 108, w: 972, h: 850 };
  return { x: 0, y: 0, w: WIDTH, h: HEIGHT };
}
export function photoPlacement(p: Project, image: HTMLImageElement, box = coverBox(p)) {
  const scale = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight) * p.crop.zoom;
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  return { x: box.x - (w - box.w) * p.crop.x, y: box.y - (h - box.h) * p.crop.y, w, h };
}
function photo(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: {x:number;y:number;w:number;h:number}, mode: 'cover' | 'contain', p: Project) {
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  if (mode === 'cover') {
    const rect = photoPlacement(p, image, box);
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  } else {
    const factor = Math.min(box.w / image.naturalWidth, box.h / image.naturalHeight);
    const w = image.naturalWidth * factor, h = image.naturalHeight * factor;
    ctx.drawImage(image, box.x + (box.w-w)/2, box.y + (box.h-h)/2, w, h);
  }
  ctx.restore();
}
function font(ctx: CanvasRenderingContext2D, size: number, weight = 400, serif = false) {
  ctx.font = `${weight} ${size}px ${serif ? TITLE_FONT : BODY_FONT}`;
}
function rule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.save(); ctx.globalAlpha = .3; ctx.fillRect(x, y, w, 1.5); ctx.restore();
}
function fitLines(ctx: CanvasRenderingContext2D, text: string, width: number, initial: number, min: number, maxLines: number, serif = false, weight = 400) {
  let size = initial;
  while (size > min) {
    font(ctx, size, weight, serif);
    if (wrapText(text, s => ctx.measureText(s).width, width).length <= maxLines) break;
    size -= 2;
  }
  font(ctx, size, weight, serif);
  return { size, lines: wrapText(text, s => ctx.measureText(s).width, width) };
}
export function renderPage(canvas: HTMLCanvasElement, p: Project, page: Page, image: HTMLImageElement, scale = 1) {
  // Detached export canvases otherwise inherit the browser's language, while
  // previews inherit <html lang="ko">. Font locale variants must match.
  canvas.lang = 'ko';
  canvas.width = WIDTH * scale; canvas.height = HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 이미지 렌더링을 시작할 수 없습니다.');
  if ('lang' in ctx) ctx.lang = 'ko';
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';
  const template = templates.find(t => t.id === p.template)!;
  const original = p.template === 'original', editorial = p.template === 'editorial';
  const paper = page.kind === 'photo' && original ? '#ffffff' : template.paper;
  const ink = page.kind === 'photo' && original ? '#565954' : template.ink;
  ctx.fillStyle = paper; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = ink;
  if (page.kind === 'cover') {
    const box = coverBox(p);
    photo(ctx, image, box, 'cover', p);
    if (original && p.gradient > 0) {
      const gradient = ctx.createLinearGradient(0, 500, 0, HEIGHT);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(.35, `rgba(0,0,0,${p.gradient})`);
      gradient.addColorStop(1, `rgba(0,0,0,${p.gradient})`);
      ctx.fillStyle = gradient; ctx.fillRect(0, 500, WIDTH, HEIGHT-500);
    }
    ctx.fillStyle = original ? '#fff' : ink;
    if (p.showNumber && p.number) {
      font(ctx, original ? 25 : 22);
      ctx.fillText(original ? `#${p.number}` : `NO. ${p.number}`, original ? 42 : 68, original ? 38 : 55);
    }
    if (!original) {
      font(ctx, 20);
      ctx.textAlign = 'right'; ctx.fillText(editorial ? 'A PERSONAL JOURNAL' : 'PHOTOGRAPHIC RECORD', 1012, 55); ctx.textAlign = 'left';
      if (editorial) rule(ctx, 68, 105, 944);
    }
    const titleX = original ? 42 : 68;
    const title = fitLines(ctx, p.title || '제목 없는 기록', original ? 980 : 944, original ? 106 : 68, 24, 2, editorial, original ? 700 : 400);
    // Variable font size keeps all titles (up to the input limit) within the cover's title area.
    const subtitle = fitLines(ctx, p.subtitle, 944, original ? 48 : 28, 18, 2);
    const step = title.size * 1.22;
    const titleY = HEIGHT - (original ? 180 : 112) - title.lines.length * step - (p.subtitle ? 12 + subtitle.lines.length * subtitle.size * 1.3 : 0);
    font(ctx, title.size, original ? 700 : 400, editorial);
    title.lines.forEach((line, i) => ctx.fillText(line.text, titleX, titleY + i * step));
    const subtitleY = titleY + title.lines.length * step + 12;
    font(ctx, subtitle.size);
    subtitle.lines.forEach((line,i) => ctx.fillText(line.text, titleX, subtitleY + i * subtitle.size * 1.3));
    if (editorial) { font(ctx, 24, 400, true); ctx.fillText('사진과 문장 사이', 68, 143); }
  } else if (page.kind === 'photo') {
    if (!original) {
      font(ctx, 22); ctx.fillText(editorial ? 'THE PHOTOGRAPH' : `FRAME ${p.number || '001'}`, 68, 58);
      rule(ctx, 68, 110, 944);
    }
    const metadata = [[p.year, p.location].filter(Boolean).join(', '), [p.camera,p.film].filter(Boolean).join(' · '),p.description].filter(Boolean).join('\n');
    const fitted = fitLines(ctx, metadata, 884, 24, 18, 5);
    // Long metadata takes space from the photograph, never from the footer.
    const metadataHeight = fitted.lines.length * fitted.size * 1.5;
    const metadataTop = Math.min(original ? 1183 : 1110, 1240 - metadataHeight);
    const photoTop = original ? 104 : 166;
    photo(ctx, image, { x: original ? 94 : 68, y: photoTop, w: original ? 892 : 944, h: metadataTop - photoTop - 20 }, 'contain', p);
    ctx.fillStyle = ink;
    ctx.textAlign = original ? 'center' : 'left';
    fitted.lines.forEach((line, i) => ctx.fillText(line.text, original ? 540 : 68, metadataTop + i*fitted.size*1.5));
    ctx.textAlign = 'left';
  } else {
    const { style } = page;
    const geo = textGeometry(style, p.lineHeight);
    ctx.fillStyle = ink;
    if (!original) {
      font(ctx, 20); ctx.fillText(editorial ? 'NOTES & THOUGHTS' : 'FIELD NOTES', style.margin, 62);
      rule(ctx, style.margin, 112, WIDTH - style.margin*2);
    }
    if (style.showTitle) {
      const title = fitLines(ctx, p.title || '제목 없는 기록', geo.width, original ? 82 : 66, 22, 3, editorial, original ? 700 : 400);
      title.lines.forEach((line, i) => ctx.fillText(line.text, style.margin, (original ? 150 : 182) + i*title.size*1.25));
    }
    font(ctx, style.fontSize);
    const usedHeight = page.lines.length * geo.step;
    const y = style.align === 'center' ? geo.top + (geo.bottom-geo.top-usedHeight)/2 : geo.top;
    page.lines.forEach((line, i) => ctx.fillText(line.text, geo.x, y + i*geo.step));
    if (!original) rule(ctx, style.margin, HEIGHT-104, geo.width);
  }
  ctx.fillStyle = page.kind === 'cover' && original ? '#ffffff' : ink;
  font(ctx, original ? 20 : 21);
  if (p.showHandle && p.handle) {
    // Fit even a long user-supplied handle without extending past the canvas edge.
    ctx.textAlign = 'right';
    ctx.fillText(p.handle, WIDTH-(original ? 24 : 68), HEIGHT-(original ? 30 : 64), 650);
    ctx.textAlign = 'left';
  }
  if (!original) {
    font(ctx, 18); ctx.fillText(`${p.number || '—'} / ${page.kind === 'cover' ? 'COVER' : page.kind === 'photo' ? 'PHOTO' : 'WORDS'}`, 68, HEIGHT-62);
  }
  ctx.resetTransform();
}
