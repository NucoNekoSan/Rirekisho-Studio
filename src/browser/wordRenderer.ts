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
  VerticalAlign,
  WidthType,
  type ISectionOptions,
} from 'docx';
import type { AccommodationData, ResumeData, TextAlignment } from '../lib/types';
import type { OfficeDatedRow, OfficeExportData, OfficeField, OfficeResumePage } from '../lib/officeExportData';
import { getTextAlignment } from '../lib/alignment';
import { OFFICE_A4, mmToTwip } from '../lib/officeLayout';

type WordChild = Paragraph | Table;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: OFFICE_A4.borderColor };
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
  shading: shaded ? { type: ShadingType.CLEAR, fill: OFFICE_A4.labelFill } : undefined,
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
    shading: shaded ? { type: ShadingType.CLEAR, fill: OFFICE_A4.labelFill } : undefined,
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    children: [new TextRun({ text: title, bold: true, font, size: 19 })],
  });
}

function datedTable(title: string, rows: OfficeDatedRow[], minRows: number, width: number, font: string, shaded: boolean, rowHeightMm?: number): WordChild[] {
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
      height: { value: rowHeightMm ? mmToTwip(rowHeightMm) : 280, rule: HeightRule.ATLEAST },
      children: [row.year, row.month, row.text].map((field, index) => cell(wordLines(field.value, font, field.alignment), widths[index])),
    }));
  }
  return [heading(title, font, shaded), new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: widths, rows: tableRows })];
}

function textBox(field: OfficeField, width: number, font: string, shaded: boolean, minBodyMm?: number): WordChild[] {
  return [heading(field.label, font, shaded), new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    rows: [new TableRow({ height: minBodyMm ? { value: mmToTwip(minBodyMm), rule: HeightRule.ATLEAST } : undefined,
      children: [cell(wordLines(field.value, font, field.alignment), width)] })],
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
    ...datedTable('免許・資格', data.qualifications, data.qualifications.length + qualificationBlanks, width, font, shaded,
      data.paperFormat === 'a3-landscape' ? 6.4 : undefined),
    ...data.appeals.flatMap((field, index) => textBox(field, width, font, shaded,
      data.paperFormat === 'a3-landscape' ? (index === 2 ? 10 : 50) : undefined)),
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

const a4Width = mmToTwip(OFFICE_A4.contentWidth);
const a4Row = (children: TableCell[], heightMm: number) => new TableRow({
  height: { value: mmToTwip(heightMm), rule: HeightRule.ATLEAST }, children,
});
const a4Cell = (value: string, widthMm: number, font: string, options: {
  shaded?: boolean; bold?: boolean; size?: number; alignment?: TextAlignment; span?: number;
} = {}) => new TableCell({
  width: { size: mmToTwip(widthMm), type: WidthType.DXA },
  columnSpan: options.span,
  borders: CELL_BORDERS,
  shading: options.shaded ? { type: ShadingType.CLEAR, fill: OFFICE_A4.labelFill } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 0, bottom: 0, left: mmToTwip(2), right: mmToTwip(2) },
  children: [paragraph(value, font, options)],
});
const a4Gap = (millimetres: number = OFFICE_A4.sectionGap) => new Paragraph({
  spacing: { before: 0, after: mmToTwip(Math.max(0, millimetres - 4)), line: 20 },
  children: [new TextRun({ text: ' ', size: 2 })],
});

function a4Title(data: OfficeExportData, font: string): WordChild[] {
  const titleBorder = { bottom: { style: BorderStyle.SINGLE, size: 10, color: '111111' } };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return [new Table({
    width: { size: a4Width, type: WidthType.DXA }, columnWidths: [mmToTwip(120), mmToTwip(68)],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [a4Row([
      new TableCell({ width: { size: mmToTwip(120), type: WidthType.DXA }, borders: titleBorder,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [paragraph('履 歴 書', font, { size: 45 })] }),
      new TableCell({ width: { size: mmToTwip(68), type: WidthType.DXA }, borders: titleBorder,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [paragraph(`作成日: ${data.printDate}  /  1/${data.pages.length}`, font, { size: 17, alignment: 'right' })] }),
    ], OFFICE_A4.titleHeight)],
  }), a4Gap(8)];
}

function a4Profile(data: OfficeExportData, font: string): WordChild[] {
  const [furigana, name, birth, age, gender] = data.profile;
  const columns = [18, 10, 55, 18, 21, 18, 14];
  const profileRows = [
    a4Row([a4Cell(furigana.label, 28, font, { shaded: true, span: 2 }),
      a4Cell(furigana.value, 126, font, { span: 5 })], 8),
    a4Row([a4Cell(name.label, 28, font, { shaded: true, span: 2 }),
      a4Cell(name.value, 126, font, { span: 5, size: 34 })], 18),
    a4Row(gender ? [
      a4Cell(birth.label, 18, font, { shaded: true }),
      a4Cell(birth.value, 65, font, { span: 2 }),
      a4Cell(age.label, 18, font, { shaded: true }),
      a4Cell(age.value, 21, font),
      a4Cell(gender.label, 18, font, { shaded: true }), a4Cell(gender.value, 14, font),
    ] : [
      a4Cell(birth.label, 18, font, { shaded: true }),
      a4Cell(birth.value, 104, font, { span: 4 }),
      a4Cell(age.label, 18, font, { shaded: true }),
      a4Cell(age.value, 14, font),
    ], 14),
  ];
  const profile = new Table({ width: { size: mmToTwip(154), type: WidthType.DXA },
    columnWidths: columns.map(mmToTwip), rows: profileRows });
  const photo = data.photoDataUrl ? photoParagraph(data.photoDataUrl, font) : paragraph('写真', font, { alignment: 'center', size: 17 });
  const outer = new Table({ width: { size: a4Width, type: WidthType.DXA },
    columnWidths: [mmToTwip(154), mmToTwip(4), mmToTwip(30)],
    rows: [a4Row([
      new TableCell({ width: { size: mmToTwip(154), type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [profile,
          new Paragraph({ spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: ' ', size: 2 })] })] }),
      new TableCell({ width: { size: mmToTwip(4), type: WidthType.DXA }, children: [paragraph('', font, { size: 2 })] }),
      new TableCell({ width: { size: mmToTwip(30), type: WidthType.DXA }, borders: CELL_BORDERS,
        verticalAlign: VerticalAlign.CENTER, children: [photo] }),
    ], OFFICE_A4.profileHeight)],
  });
  const [address, phone, email, contactAddress, contactPhone] = data.contact;
  const contact = new Table({ width: { size: a4Width, type: WidthType.DXA },
    columnWidths: [28, 66, 28, 66].map(mmToTwip),
    rows: [
      a4Row([a4Cell(address.label, 28, font, { shaded: true }), a4Cell(address.value, 160, font, { span: 3 })], OFFICE_A4.contactRowHeight),
      a4Row([a4Cell(phone.label, 28, font, { shaded: true }), a4Cell(phone.value, 66, font),
        a4Cell(email.label, 28, font, { shaded: true }), a4Cell(email.value, 66, font)], OFFICE_A4.contactRowHeight),
      a4Row([a4Cell(contactAddress.label, 28, font, { shaded: true }), a4Cell(contactAddress.value, 160, font, { span: 3 })], OFFICE_A4.contactRowHeight),
      a4Row([a4Cell(contactPhone.label, 28, font, { shaded: true }), a4Cell(contactPhone.value, 160, font, { span: 3 })], OFFICE_A4.contactRowHeight),
    ],
  });
  return [outer, a4Gap(7), contact, a4Gap(7)];
}

function a4Dated(title: string, rows: OfficeDatedRow[], minRows: number, font: string, qualification = false): Table {
  const values = [...rows];
  while (values.length < minRows) values.push({
    year: { label: '年', value: '', alignment: 'left' },
    month: { label: '月', value: '', alignment: 'left' },
    text: { label: '内容', value: '', alignment: 'left' },
  });
  const rowHeight = qualification ? OFFICE_A4.qualificationRowHeight
    : minRows >= 21 ? OFFICE_A4.historyRowHeight - 0.22 : OFFICE_A4.historyRowHeight;
  return new Table({ width: { size: a4Width, type: WidthType.DXA },
    columnWidths: [18, 14, 156].map(mmToTwip),
    rows: [
      a4Row([a4Cell(title, 188, font, { shaded: true, span: 3 })], OFFICE_A4.historyHeadingHeight),
      a4Row([a4Cell('年', 18, font, { alignment: 'center' }), a4Cell('月', 14, font, { alignment: 'center' }),
        a4Cell('内容', 156, font, { alignment: 'center' })], OFFICE_A4.historyHeaderHeight),
      ...values.map((entry) => a4Row([
        a4Cell(entry.year.value, 18, font, { alignment: entry.year.alignment }),
        a4Cell(entry.month.value, 14, font, { alignment: entry.month.alignment }),
        a4Cell(entry.text.value, 156, font, { alignment: entry.text.alignment }),
      ], rowHeight)),
    ],
  });
}

function a4Text(field: OfficeField, font: string, heightMm: number): Table {
  return new Table({ width: { size: a4Width, type: WidthType.DXA }, columnWidths: [a4Width],
    rows: [a4Row([a4Cell(field.label, 188, font, { shaded: true })], OFFICE_A4.textHeadingHeight),
      new TableRow({ height: { value: mmToTwip(heightMm - OFFICE_A4.textHeadingHeight), rule: HeightRule.ATLEAST },
        children: [new TableCell({ width: { size: a4Width, type: WidthType.DXA }, borders: CELL_BORDERS,
          margins: { top: mmToTwip(2), bottom: 0, left: mmToTwip(2), right: mmToTwip(2) },
          children: wordLines(field.value, font, field.alignment) })] })],
  });
}

function a4Mini(fields: OfficeField[], font: string): Table {
  return new Table({ width: { size: a4Width, type: WidthType.DXA }, columnWidths: [94, 94].map(mmToTwip),
    rows: [0, 2].flatMap((start) => [
      a4Row([a4Cell(fields[start].label, 94, font, { shaded: true }), a4Cell(fields[start + 1].label, 94, font, { shaded: true })], 4),
      a4Row([a4Cell(fields[start].value, 94, font, { alignment: fields[start].alignment }),
        a4Cell(fields[start + 1].value, 94, font, { alignment: fields[start + 1].alignment })], 7.5),
    ]),
  });
}

function pageContents(page: OfficeResumePage, data: OfficeExportData, font: string): WordChild[] {
  const isA3 = page.kind === 'a3';
  const width = isA3 ? 10800 : 10600;
  const shaded = !isA3;
  if (isA3) {
    const left: WordChild[] = [...pageTitle(data, font, 1), ...profileBlock(data, width, font, false),
      ...datedTable('学歴・職歴', page.historyLeft, 22, width, font, false, 7.5), paragraph('', font)];
    const right: WordChild[] = [
      ...datedTable('学歴・職歴（続き）', page.historyRight, 7, width, font, false, 7.5),
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
    ...a4Title(data, font), ...a4Profile(data, font),
    a4Dated('学歴・職歴', page.historyLeft, 21, font),
  ];
  if (page.kind === 'a4-second') return [
    paragraph(`2/${data.pages.length}`, font, { alignment: 'right', size: 17 }), a4Gap(2),
    a4Dated('学歴・職歴', page.historyLeft, 5, font), a4Gap(7),
    a4Dated('免許・資格', data.qualifications, Math.max(6, data.qualifications.length), font, true), a4Gap(7),
    a4Text(data.appeals[0], font, OFFICE_A4.motivationHeight - 4), a4Gap(8),
    a4Text(data.appeals[1], font, OFFICE_A4.selfPrHeight - 4), a4Gap(8),
    a4Text(data.appeals[2], font, OFFICE_A4.requestsHeight - 1), a4Gap(8),
    a4Mini(data.mini, font),
  ];
  return [
    paragraph(`履歴書（続き） ${data.pages.indexOf(page) + 1}/${data.pages.length}`, font, { alignment: 'right', size: 16 }),
    ...datedTable('学歴・職歴（続き）', page.historyLeft, 0, isA3 ? 22000 : width, font, shaded,
      isA3 ? 7.5 : undefined),
  ];
}

function resumeSection(page: OfficeResumePage, data: OfficeExportData, resume: ResumeData): ISectionOptions {
  const isA3 = data.paperFormat === 'a3-landscape';
  return {
    properties: { page: { size: {
      width: isA3 ? 16838 : 11906,
      height: isA3 ? 23811 : 16838,
      orientation: isA3 ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
    }, margin: { top: mmToTwip(isA3 ? 10 : page.kind === 'a4-second' ? 6 : OFFICE_A4.margin),
      bottom: mmToTwip(3), left: mmToTwip(isA3 ? 10 : OFFICE_A4.margin),
      right: mmToTwip(isA3 ? 10 : OFFICE_A4.margin) } } },
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
