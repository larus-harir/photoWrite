import { useLayoutEffect, useRef } from 'react';
import type { Page, Project } from '../types';
import { renderPage } from '../lib/render';
interface Props { project: Project; page: Page; image: HTMLImageElement; thumbnail?: boolean; onError: (s: string) => void }
export function PageCanvas({project,page,image,thumbnail,onError}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    try { if (ref.current) renderPage(ref.current,project,page,image,thumbnail ? .17 : 1); }
    catch(e) { onError(e instanceof Error ? e.message : '미리보기를 만들지 못했습니다.'); }
  },[project,page,image,thumbnail,onError]);
  return <canvas ref={ref} role="img" aria-label={`${page.kind === 'cover' ? '표지' : page.kind === 'photo' ? '사진 정보' : '본문'} 미리보기`} />;
}
