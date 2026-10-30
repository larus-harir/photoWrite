import type { Page, PageStyle, Project, TextLine } from '../types';
export const WIDTH = 1080;
export const HEIGHT = 1350;
export const BODY_FONT = '"Noto Sans KR"';
export const TITLE_FONT = '"Noto Serif KR"';
type Measure = (text: string) => number;
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

/** raw fragments concatenate to the exact input, including whitespace and newlines. */
export function wrapText(source: string, measure: Measure, width: number, limit = Infinity): TextLine[] {
  if (!source) return [];
  const result: TextLine[] = [];
  const logicalLines = source.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const logical of logicalLines) {
    const hasNewline = logical.endsWith('\n');
    const content = hasNewline ? logical.slice(0, -1) : logical;
    const glyphs = Array.from(segmenter.segment(content), v => v.segment);
    if (!glyphs.length) { result.push({ text: '', raw: logical }); if (result.length >= limit) return result; continue; }
    while (glyphs.length) {
      let count = 0;
      let candidate = '';
      while (count < glyphs.length && (count === 0 || measure(candidate + glyphs[count]) <= width)) candidate += glyphs[count++];
      if (count < glyphs.length) {
        // Prefer a word boundary for Latin text; Korean remains safely character-wrapped.
        const partial = glyphs.slice(0, count).join('');
        const lastSpace = partial.lastIndexOf(' ');
        if (/[a-zA-Z]$/.test(partial) && /^[a-zA-Z]/.test(glyphs[count]) && lastSpace > partial.length * .45) {
          count = Array.from(segmenter.segment(partial.slice(0, lastSpace + 1))).length;
        }
        if (/^[,.;!?，。！？、)\]”’]/.test(glyphs[count]) && count > 1) count--;
      }
      const text = glyphs.splice(0, count).join('');
      result.push({ text: text.replace(/\r$/, ''), raw: text + (!glyphs.length && hasNewline ? '\n' : '') });
      if (result.length >= limit) return result;
    }
  }
  return result;
}
export function textGeometry(style: Required<PageStyle>, lineHeight: number) {
  const top = style.showTitle ? 490 : 220;
  const bottom = HEIGHT - style.margin - 70;
  const step = style.fontSize * lineHeight;
  return { x: style.margin, top, bottom, width: WIDTH - 2 * style.margin, step, capacity: Math.max(1, Math.floor((bottom - top) / step)) };
}
export function defaultStyle(p: Project): Required<PageStyle> {
  return { fontSize: p.fontSize, margin: p.margin, align: p.textAlign, showTitle: p.showTitle };
}
/** Page-specific metrics are applied before allocating each page, never after. */
export function paginate(p: Project, measureFactory: (size: number) => Measure): Page[] {
  const base = defaultStyle(p);
  const pages: Page[] = ['cover', 'photo'].map(kind => ({ id: kind, kind: kind as 'cover' | 'photo', lines: [], source: '', style: base }));
  if (!p.body.trim()) return pages;
  const sections = p.body.split(/^[\t ]*---page---[\t ]*\r?$/m);
  sections.forEach((section, sectionIndex) => {
    let rest = section;
    let partIndex = 0;
    if (!rest) return;
    while (rest.length) {
      const id = `text-${sectionIndex}-${partIndex++}`;
      const style = { ...base, ...p.pageStyles[id] };
      const geo = textGeometry(style, p.lineHeight);
      const measure = measureFactory(style.fontSize);
      const lines: TextLine[] = [];
      // Keep a paragraph together if it fits on an empty page.
      const blocks = rest.match(/[\s\S]+?(?:\n[\t ]*\n|$)/g) ?? [rest];
      for (const block of blocks) {
        // One lookahead line tells us whether this paragraph fits. Never rewrap
        // the entire remaining manuscript just to fill a single page.
        const wrapped = wrapText(block, measure, geo.width, geo.capacity + 1);
        if (lines.length && wrapped.length <= geo.capacity && lines.length + wrapped.length > geo.capacity) break;
        const available = geo.capacity - lines.length;
        lines.push(...wrapped.slice(0, available));
        if (wrapped.length >= available) break;
      }
      const source = lines.map(line => line.raw).join('');
      if (!source.length) break;
      pages.push({ id, kind: 'text', lines, source, style, continued: partIndex > 1 });
      rest = rest.slice(source.length);
    }
  });
  return pages;
}
export function orderedPages(pages: Page[], order: string[]) {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...pages].sort((a, b) => (rank.get(a.id) ?? order.length + pages.indexOf(a)) - (rank.get(b.id) ?? order.length + pages.indexOf(b)));
}
