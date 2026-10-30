export type TemplateId = 'original' | 'editorial' | 'film';
export type PageKind = 'cover' | 'photo' | 'text';
export interface Crop { x: number; y: number; zoom: number }
export interface PageStyle { fontSize?: number; margin?: number; align?: 'top' | 'center'; showTitle?: boolean }
export interface Project {
  version: 1;
  title: string; subtitle: string; number: string; showNumber: boolean;
  body: string; year: string; location: string; camera: string; film: string; description: string;
  handle: string; showHandle: boolean; template: TemplateId;
  photo: string; photoName: string; photoWidth: number; photoHeight: number;
  crop: Crop; gradient: number; fontSize: number; lineHeight: number; margin: number;
  showTitle: boolean; textAlign: 'top' | 'center';
  pageStyles: Record<string, PageStyle>; pageOrder: string[];
}
export interface TextLine { text: string; raw: string }
export interface Page { id: string; kind: PageKind; lines: TextLine[]; source: string; style: Required<PageStyle>; continued?: boolean }
export interface Template { id: TemplateId; name: string; label: string; description: string; tag: string; paper: string; ink: string }
export const templates: Template[] = [
  { id: 'original', name: 'Original Archive', label: '오리지널 아카이브', description: '익숙한 기록, 사진과 문장 그대로.', tag: '기존 스타일', paper: '#091114', ink: '#f5f5f0' },
  { id: 'editorial', name: 'Editorial Journal', label: '에디토리얼 저널', description: '여백 사이로 읽히는 작은 문예지.', tag: '추천', paper: '#f2efe7', ink: '#313b31' },
  { id: 'film', name: 'Film Archive', label: '필름 아카이브', description: '한 장의 인화지처럼 오래 남도록.', tag: '새로운 시선', paper: '#e9e5db', ink: '#292a24' },
];
