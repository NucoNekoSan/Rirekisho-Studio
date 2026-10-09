import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from 'docx';
import type { AccommodationData, ResumeData, TextAlignment } from '../lib/types';
import type { OfficeDatedRow, OfficeExportData, OfficeField, OfficeResumePage } from '../lib/officeExportData';
import { getTextAlignment } from '../lib/alignment';

type WordChild = Paragraph | Table;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '777777' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT } as const;

const fontName = (resume: ResumeData) => resume.pdfFontFamily === 'mincho' ? 'Yu Mincho' : 'Yu Gothic';
const paragraph = (value: string, font: string, options: { bold?: boolean; alignment?: TextAlignment; size?: number } = {}) =>
  new Paragraph({
    alignment: options.alignment ? ALIGN[options.alignment] : undefined,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: value || ' ', bold: options.bold, font, size: options.size ?? 17 })],
  });
const cell = (children: WordChild[], width: number, shaded = false) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  borders: CELL_BORDERS,
  shading: shaded ? { type: ShadingType.CLEAR, fill: 'E8ECEF' } : undefined,
  margins: { top: 15, bottom: 15, left: 80, right: 80 },
  children,
});

function wordLines(value: string, font: string, alignment: TextAlignment): Paragraph[] {
  return value.split(/\r?\n/).map((line) => paragraph(line, font, { alignment }));
}

function fieldTable(fields: OfficeField[], width: number, font: string, shaded: boolean): Table {
  const labelWidth = Math.round(width * 0.25);
  const valueWidth = width - labelWidth;
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [labelWidth, valueWidth],
    rows: fields.map((field) => new TableRow({
      children: [
        cell([paragraph(field.label, font, { bold: true, size: 17 })], labelWidth, shaded),
        cell(wordLines(field.value, font, field.alignment), valueWidth),
      ],
    })),
  });
}

function photoParagraph(dataUrl: string | null, font: string): Paragraph {
  if (!dataUrl) return paragraph('写真', font, { alignment: 'center' });
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('写真データをWordへ埋め込めませんでした。');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  return new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({
    type: match[1] === 'jpeg' ? 'jpg' : 'png',
    data: bytes,
    transformation: { width: 95, height: 127 },
  })] });
}

function profileBlock(data: OfficeExportData, width: number, font: string, shaded: boolean): WordChild[] {
  const photoWidth = Math.round(width * 0.23);
  const mainWidth = width - photoWidth;
  const profile = new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [mainWidth, photoWidth],
    rows: [new TableRow({ children: [
      cell([fieldTable(data.profile, mainWidth - 200, font, shaded), paragraph('', font)], mainWidth),
      cell([photoParagraph(data.photoDataUrl, font)], photoWidth),
    ] })],
  });
  return [profile, paragraph('', font), fieldTable(data.contact, width, font, shaded)];
}

function heading(title: string, font: string, shaded: boolean): Paragraph {
  return new Paragraph({
    spacing: { before: 150, after: 0 },
    shading: shaded ? { type: ShadingType.CLEAR, fill: 'E8ECEF' } : undefined,
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    children: [new TextRun({ text: title, bold: true, font, size: 19 })],
  });
}

function datedTable(title: string, rows: OfficeDatedRow[], minRows: number, width: number, font: string, shaded: boolean): WordChild[] {
  const widths = [Math.round(width * 0.10), Math.round(width * 0.08), 0];
  widths[2] = width - widths[0] - widths[1];
  const values = [...rows];
  while (values.length < minRows) values.push({
    year: { label: '年', value: '', alignment: 'left' },
    month: { label: '月', value: '', alignment: 'left' },
    text: { label: '内容', value: '', alignment: 'left' },
  });
  const tableRows = [new TableRow({ children: ['年', '月', '内容'].map((label, index) =>
    cell([paragraph(label, font, { bold: true, alignment: 'center', size: 17 })], widths[index], shaded)) })];
  for (const row of values) {
    tableRows.push(new TableRow({
      height: { value: 280, rule: HeightRule.ATLEAST },
      children: [row.year, row.month, row.text].map((field, index) => cell(wordLines(field.value, font, field.alignment), widths[index])),
    }));
  }
  return [heading(title, font, shaded), new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: widths, rows: tableRows })];
}

function textBox(field: OfficeField, width: number, font: string, shaded: boolean): WordChild[] {
  return [heading(field.label, font, shaded), new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    rows: [new TableRow({ children: [cell(wordLines(field.value, font, field.alignment), width)] })],
  })];
}

function miniGrid(fields: OfficeField[], width: number, font: string, shaded: boolean): Table {
  const half = Math.floor(width / 2);
  const miniCell = (field: OfficeField, cellWidth: number) => cell([
    paragraph(field.label, font, { bold: true, size: 17 }),
    ...wordLines(field.value, font, field.alignment),
  ], cellWidth, shaded);
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [half, width - half],
    rows: [
      new TableRow({ children: [miniCell(fields[0], half), miniCell(fields[1], width - half)] }),
      new TableRow({ children: [miniCell(fields[2], half), miniCell(fields[3], width - half)] }),
    ],
  });
}

function detailBlock(data: OfficeExportData, width: number, font: string, shaded: boolean): WordChild[] {
  const qualificationBlanks = data.appeals.some((field) => field.value.length > 200)
    ? 0
    : (data.paperFormat === 'a3-landscape' ? 3 : 5);
  return [
    ...datedTable('免許・資格', data.qualifications, data.qualifications.length + qualificationBlanks, width, font, shaded),
    ...data.appeals.flatMap((field) => textBox(field, width, font, shaded)),
    heading('通勤・扶養', font, shaded),
    miniGrid(data.mini, width, font, shaded),
  ];
}

function pageTitle(data: OfficeExportData, font: string, pageNumber: number): WordChild[] {
  return [new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: '333333' } },
    spacing: { after: 180 },
    children: [
      new TextRun({ text: '履歴書', bold: true, font, size: 30 }),
      new TextRun({ text: `     作成日: ${data.printDate} / ${pageNumber}/${data.pages.length}`, font, size: 16 }),
    ],
  })];
}

function pageContents(page: OfficeResumePage, data: OfficeExportData, font: string): WordChild[] {
  const isA3 = page.kind === 'a3';
  const width = isA3 ? 10800 : 10600;
  const shaded = !isA3;
  if (isA3) {
    const left: WordChild[] = [...pageTitle(data, font, 1), ...profileBlock(data, width, font, false),
      ...datedTable('学歴・職歴', page.historyLeft, 22, width, font, false), paragraph('', font)];
    const right: WordChild[] = [
      ...datedTable('学歴・職歴（続き）', page.historyRight, 7, width, font, false),
      ...detailBlock(data, width, font, false), paragraph('', font),
    ];
    return [new Table({
      width: { size: 22000, type: WidthType.DXA },
      columnWidths: [10800, 400, 10800],
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: 10800, type: WidthType.DXA }, children: left }),
        new TableCell({ width: { size: 400, type: WidthType.DXA }, children: [paragraph('', font)] }),
        new TableCell({ width: { size: 10800, type: WidthType.DXA }, children: right }),
      ] })],
    })];
  }
  if (page.kind === 'a4-first') return [
    ...pageTitle(data, font, 1),
    ...profileBlock(data, width, font, shaded),
    ...datedTable('学歴・職歴', page.historyLeft, 21, width, font, shaded),
  ];
  if (page.kind === 'a4-second') return [
    paragraph(`2/${data.pages.length}`, font, { alignment: 'right', size: 16 }),
    ...datedTable('学歴・職歴（続き）', page.historyLeft, 5, width, font, shaded),
    ...detailBlock(data, width, font, shaded),
  ];
  return [
    paragraph(`履歴書（続き） ${data.pages.indexOf(page) + 1}/${data.pages.length}`, font, { alignment: 'right', size: 16 }),
    ...datedTable('学歴・職歴（続き）', page.historyLeft, 0, width, font, shaded),
  ];
}

function resumeSection(page: OfficeResumePage, data: OfficeExportData, resume: ResumeData): ISectionOptions {
  const isA3 = data.paperFormat === 'a3-landscape';
  return {
    properties: { page: { size: {
      width: isA3 ? 16838 : 11906,
      height: isA3 ? 23811 : 16838,
      orientation: isA3 ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
    }, margin: { top: 560, bottom: 560, left: 560, right: 560 } } },
    children: pageContents(page, data, fontName(resume)),
  };
}

function accommodationSection(data: OfficeExportData, resume: ResumeData, accommodation: AccommodationData, pageIndex: number): ISectionOptions {
  const font = fontName(resume);
  const page = data.accommodationPages![pageIndex];
  const children: WordChild[] = [
    heading(`就労上の配慮事項シート  ${page.pageNumber}/${data.accommodationPages!.length}`, font, true),
  ];
  if (page.showNote) children.push(paragraph('この書類は、応募先へ伝える必要がある範囲だけを本人が選んで作成する補助資料です。', font));
  for (const section of page.sections) {
    if (section.type === 'empty') children.push(paragraph('出力対象の項目がありません。', font));
    else children.push(...textBox({
      label: `${section.label}${section.continued ? '（続き）' : ''}`,
      value: section.value,
      alignment: getTextAlignment(accommodation.textAlignments, section.fieldKey),
    }, 10600, font, true));
  }
  return {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 560, bottom: 560, left: 560, right: 560 } } },
    children,
  };
}

export async function createWordDocument(data: OfficeExportData, resume: ResumeData, accommodation: AccommodationData): Promise<Blob> {
  const sections = data.pages.map((page) => resumeSection(page, data, resume));
  data.accommodationPages?.forEach((_, index) => sections.push(accommodationSection(data, resume, accommodation, index)));
  return Packer.toBlob(new Document({ sections }));
}
