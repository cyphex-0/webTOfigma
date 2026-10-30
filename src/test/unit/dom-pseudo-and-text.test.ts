import { describe, it, expect } from 'vitest';
import {
  parseFontWeight,
  parseFontSize,
  parseLineHeight,
  parseLetterSpacing,
  parseFontStyle,
  parseTextAlign,
  normalizeWhitespace,
  extractDirectText,
  extractTextRuns
} from '../../core/dom/text-extractor';
import {
  cleanPseudoContent,
  extractPseudoElements
} from '../../core/dom/pseudo-elements';
import { TextRunSchema, SourceNodeSchema } from '../../shared/schemas/source-node.schema';
import type { SourceRect } from '../../shared/contracts/source-node';

describe('Typography and Text Extraction Engine', () => {
  it('parses typography values into standard units', () => {
    expect(parseFontWeight('bold')).toBe(700);
    expect(parseFontWeight('normal')).toBe(400);
    expect(parseFontWeight('lighter')).toBe(300);
    expect(parseFontWeight('600')).toBe(600);
    expect(parseFontWeight('950')).toBe(900); // Clamped

    expect(parseFontSize('18px')).toBe(18);
    expect(parseFontSize('-5px')).toBe(16); // Fallback
    expect(parseFontSize(null)).toBe(16);

    expect(parseLineHeight('24px', 16)).toBe(24);
    expect(parseLineHeight('1.5', 16)).toBe(24); // Multiplier
    expect(parseLineHeight('normal', 16)).toBe(19.2);

    expect(parseLetterSpacing('0.5px')).toBe(0.5);
    expect(parseLetterSpacing('normal')).toBe(0);

    expect(parseFontStyle('italic')).toBe('italic');
    expect(parseFontStyle('normal')).toBe('normal');

    expect(parseTextAlign('center')).toBe('center');
    expect(parseTextAlign('end')).toBe('right');
    expect(parseTextAlign('start')).toBe('left');
  });

  it('normalizes whitespace according to CSS white-space rules', () => {
    const raw = '   Hello\n   World   \t  !';
    expect(normalizeWhitespace(raw, 'normal')).toBe(' Hello World !');
    expect(normalizeWhitespace(raw, 'pre')).toBe(raw);
    expect(normalizeWhitespace('A   B\nC   D', 'pre-line')).toBe('A B\nC D');
  });

  it('extracts direct text nodes without duplicating child element text', () => {
    const parent = document.createElement('div');
    parent.appendChild(document.createTextNode('Hello '));

    const span = document.createElement('span');
    span.textContent = 'Beautiful';
    parent.appendChild(span);

    parent.appendChild(document.createTextNode(' World!'));

    // Extract direct text on parent
    const parentText = extractDirectText(parent);
    expect(parentText).toBe('Hello World!');

    // Extract direct text on span
    const spanText = extractDirectText(span);
    expect(spanText).toBe('Beautiful');
  });

  it('produces valid TextRun records matching TextRunSchema', () => {
    const p = document.createElement('p');
    p.textContent = 'The quick brown fox';

    const runs = extractTextRuns(p, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      fontWeight: '700',
      fontStyle: 'normal',
      lineHeight: '28px',
      letterSpacing: '0px',
      color: '#1e293b',
      textAlign: 'left'
    });

    expect(runs).toHaveLength(1);
    const parsed = TextRunSchema.safeParse(runs[0]);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.text).toBe('The quick brown fox');
      expect(parsed.data.fontSize).toBe(20);
      expect(parsed.data.fontWeight).toBe(700);
      expect(parsed.data.color).toBe('#1e293b');
    }
  });
});

describe('Pseudo-Element Synthesis Engine (::before / ::after)', () => {
  const parentRect: SourceRect = { x: 50, y: 50, width: 200, height: 40 };
  const parentDocRect: SourceRect = { x: 50, y: 150, width: 200, height: 40 };

  it('cleans quoted content from pseudo elements', () => {
    expect(cleanPseudoContent('"★"')).toBe('★');
    expect(cleanPseudoContent("'Arrow'")).toBe('Arrow');
    expect(cleanPseudoContent('none')).toBe('');
    expect(cleanPseudoContent('normal')).toBe('');
    expect(cleanPseudoContent('')).toBe('');
  });

  it('synthesizes valid SourceNode instances for visually meaningful pseudo elements', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    // Mock getComputedStyle for pseudo elements
    const origGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element, pseudo?: string | null) => {
      if (pseudo === '::before') {
        return {
          content: '"★"',
          display: 'inline-block',
          color: '#f59e0b',
          fontSize: '14px',
          fontWeight: '700',
          lineHeight: '14px',
          width: '16px',
          height: '16px',
          backgroundColor: 'transparent'
        } as any;
      }
      if (pseudo === '::after') {
        return {
          content: 'none',
          display: 'none'
        } as any;
      }
      return origGetComputedStyle(target, pseudo);
    }) as any;

    let idSeq = 1;
    const idGen = () => `node_pseudo_${idSeq++}`;

    const syntheticNodes = extractPseudoElements(
      el,
      'node_parent_100',
      idGen,
      parentRect,
      parentDocRect
    );

    // Restore computed style
    window.getComputedStyle = origGetComputedStyle;
    document.body.removeChild(el);

    expect(syntheticNodes).toHaveLength(1);
    const beforeNode = syntheticNodes[0]!;
    expect(beforeNode.sourceTag).toBe('::before');
    expect(beforeNode.parentId).toBe('node_parent_100');
    expect(beforeNode.textRuns).toHaveLength(1);
    expect(beforeNode.textRuns[0]?.text).toBe('★');

    // Validate against SourceNodeSchema
    const parseRes = SourceNodeSchema.safeParse(beforeNode);
    expect(parseRes.success).toBe(true);
  });
});
