import { fontFamily } from './fonts';
import type { FontId } from './fonts';
const cache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  const previous = cache.get(src);
  if (previous) return previous;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { cache.delete(src); reject(new Error('사진을 읽을 수 없습니다. JPG, PNG 또는 WebP 파일을 다시 선택해 주세요.')); };
    image.src = src;
  });
  // Avoid retaining previous large uploads indefinitely.
  if (cache.size > 5) cache.clear();
  cache.set(src, promise);
  return promise;
}
export async function readPhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WebP 사진을 선택해 주세요. HEIC는 JPG로 변환한 뒤 올려주세요.');
  if (file.size > 30 * 1024 * 1024) throw new Error('사진은 30MB 이하로 올려주세요.');
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다. 다시 시도해 주세요.'));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(src);
  if (image.naturalWidth * image.naturalHeight > 80_000_000) throw new Error('사진이 너무 큽니다. 8천만 픽셀 이하로 줄여주세요.');
  const probe = document.createElement('canvas');
  probe.width = 48; probe.height = 48;
  const context = probe.getContext('2d');
  if (!context) throw new Error('이 브라우저에서 사진을 읽을 수 없습니다.');
  context.drawImage(image, 0, 0, 48, 48);
  const pixels = context.getImageData(0, 0, 48, 48).data;
  if (!pixels.some((v, i) => i % 4 === 3 && v > 0)) throw new Error('완전히 투명한 이미지입니다. 내용이 있는 사진을 선택해 주세요.');
  return { photo: src, photoName: file.name, photoWidth: image.naturalWidth, photoHeight: image.naturalHeight };
}
export async function ensureFonts(text: string, selected: FontId[] = ['noto-sans']) {
  const sample = `사진과 문장 ${text} ABC123 #005`;
  try {
    const requests=[...new Set(['noto-sans',...selected] as FontId[])].flatMap(id=>[400,700].map(weight=>`${weight} 36px ${fontFamily(id)}`));
    await Promise.all(requests.map(request=>document.fonts.load(request,sample)));
    await document.fonts.ready;
    if(requests.some(request=>!document.fonts.check(request,sample)))throw new Error('font');
  } catch { throw new Error('글꼴을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'); }
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
