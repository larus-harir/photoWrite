import type { Project } from '../types';
export const fonts = [
  { id:'noto-sans', family:'Noto Sans KR', name:'Noto Sans KR', mood:'기본 서체 · 또렷하고 담백한 고딕', source:'https://fonts.google.com/noto/specimen/Noto+Sans+KR' },
  { id:'noto-serif', family:'Noto Serif KR', name:'Noto Serif KR', mood:'정갈한 명조 · 문예지와 긴 호흡의 글', source:'https://fonts.google.com/noto/specimen/Noto+Serif+KR' },
  { id:'gowun', family:'Gowun Batang', name:'고운 바탕', mood:'부드러운 명조 · 다정한 에세이와 일상', source:'https://fonts.google.com/specimen/Gowun+Batang' },
  { id:'plex', family:'IBM Plex Sans KR', name:'IBM Plex Sans KR', mood:'현대적인 고딕 · 사진집과 편집 디자인', source:'https://fonts.google.com/specimen/IBM+Plex+Sans+KR' },
] as const;
export type FontId = typeof fonts[number]['id'];
export function fontFamily(id?: FontId) { return `"${(fonts.find(f=>f.id===id)??fonts[0]).family}"`; }
export function bodyFont(p:Project) { return fontFamily(p.bodyFont); }
export function titleFont(p:Project) { return fontFamily(p.titleFont); }
