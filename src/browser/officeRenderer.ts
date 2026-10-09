import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from 'docx';
import ExcelJS from 'exceljs';
import { downloadBlob } from './downloadFile';
import { buildOfficeExportData, type OfficeExportData, type OfficeField, type OfficeSection } from '../lib/officeExportData';
import type { AccommodationData, PdfPaperFormat, ResumeData, TextAlignment } from '../lib/types';

export type OfficeFormat = 'docx' | 'xlsx';
const alignment = (value: TextAlignment) => ({ left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT })[value];
const fontName = (resume: ResumeData) => resume.pdfFontFamily === 'mincho' ? 'Yu Mincho' : 'Yu Gothic';
const pngOrJpeg = (dataUrl: string) => {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('写真データをWord・Excelへ埋め込めませんでした。');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  return { type: match[1] as 'png' | 'jpeg', bytes };
};

function wordField(field: OfficeField, font: string): TableRow {
  const borders = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
  return new TableRow({ children: [
    new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, shading: { fill: 'F0F2F4' }, borders: { top: borders, bottom: borders, left: borders, right: borders }, children: [new Paragraph({ children: [new TextRun({ text: field.label, bold: true, font, size: 19 })] })] }),
    new TableCell({ width: { size: 76, type: WidthType.PERCENTAGE }, borders: { top: borders, bottom: borders, left: borders, right: borders }, children: [new Paragraph({ alignment: alignment(field.alignment), children: [new TextRun({ text: field.value || ' ', font, size: 19 })] })] }),
  ] });
}

function wordSection(section: OfficeSection, font: string): Array<Paragraph | Table> {
  return [
    new Paragraph({ spacing: { before: 180, after: 70 }, children: [new TextRun({ text: section.title, bold: true, font, size: 22 })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: section.fields.length ? section.fields.map((field) => wordField(field, font)) : [wordField({ label: '', value: '', alignment: 'left' }, font)] }),
  ];
}

function wordPage(data: OfficeExportData, resume: ResumeData, paperFormat: PdfPaperFormat, accommodationPage: boolean): ISectionOptions {
  const font = fontName(resume);
  const sections = accommodationPage ? data.accommodationSections : data.sections;
  const children: Array<Paragraph | Table> = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: accommodationPage ? '配慮事項シート' : '履歴書', bold: true, font, size: 32 })] })];
  if (!accommodationPage && data.photoDataUrl) {
    const { type, bytes } = pngOrJpeg(data.photoDataUrl);
    children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: type === 'jpeg' ? 'jpg' : 'png', data: bytes, transformation: { width: 95, height: 127 } })] }));
  }
  for (const section of sections) children.push(...wordSection(section, font));
  const isA3 = !accommodationPage && paperFormat === 'a3-landscape';
  return {
    properties: {
      page: {
        size: { width: isA3 ? 23811 : 11906, height: isA3 ? 16838 : 16838 },
        margin: { top: 560, right: 560, bottom: 560, left: 560 },
      },
    },
    children,
  };
}

async function createWord(data: OfficeExportData, resume: ResumeData): Promise<Blob> {
  const pages = [wordPage(data, resume, resume.pdfPaperFormat, false)];
  if (data.accommodationSections.length) pages.push(wordPage(data, resume, 'a4-portrait', true));
  return Packer.toBlob(new Document({ sections: pages }));
}

function excelSheet(workbook: ExcelJS.Workbook, sections: OfficeSection[], title: string, resume: ResumeData, paperFormat: PdfPaperFormat, photoDataUrl: string | null) {
  const sheet = workbook.addWorksheet(title, {
    pageSetup: {
      paperSize: (paperFormat === 'a3-landscape' ? 8 : 9) as ExcelJS.PaperSize,
      orientation: paperFormat === 'a3-landscape' ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: paperFormat === 'a3-landscape' ? 1 : 2,
    },
  });
  sheet.columns = [{ width: 24 }, { width: 65 }];
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { name: fontName(resume), size: 18, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  let rowNumber = 3;
  if (photoDataUrl) {
    const { type } = pngOrJpeg(photoDataUrl);
    const imageId = workbook.addImage({ base64: photoDataUrl, extension: type === 'jpeg' ? 'jpeg' : 'png' });
    sheet.addImage(imageId, { tl: { col: 1, row: 1 }, ext: { width: 95, height: 127 } });
    rowNumber = 10;
  }
  for (const section of sections) {
    sheet.mergeCells(rowNumber, 1, rowNumber, 2);
    const heading = sheet.getCell(rowNumber, 1);
    heading.value = section.title;
    heading.font = { name: fontName(resume), bold: true, size: 11 };
    heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECEF' } };
    rowNumber += 1;
    for (const field of section.fields) {
      const label = sheet.getCell(rowNumber, 1);
      const value = sheet.getCell(rowNumber, 2);
      label.value = field.label;
      value.value = field.value;
      label.font = { name: fontName(resume), bold: true, size: 10 };
      value.font = { name: fontName(resume), size: 10 };
      value.alignment = { horizontal: field.alignment, vertical: 'middle', wrapText: true };
      label.alignment = { vertical: 'middle', wrapText: true };
      label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F4' } };
      for (const cell of [label, value]) cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      sheet.getRow(rowNumber).height = Math.max(23, Math.ceil(field.value.length / 34) * 15);
      rowNumber += 1;
    }
    rowNumber += 1;
  }
  sheet.pageSetup.printArea = `A1:B${rowNumber - 1}`;
  return sheet;
}

async function createExcel(data: OfficeExportData, resume: ResumeData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  excelSheet(workbook, data.sections, '履歴書', resume, resume.pdfPaperFormat, data.photoDataUrl);
  if (data.accommodationSections.length) excelSheet(workbook, data.accommodationSections, '配慮事項シート', resume, 'a4-portrait', null);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function downloadOfficeDocument(format: OfficeFormat, resume: ResumeData, accommodation: AccommodationData, includeAccommodation: boolean): Promise<void> {
  const data = buildOfficeExportData(resume, accommodation, includeAccommodation);
  const blob = format === 'docx' ? await createWord(data, resume) : await createExcel(data, resume);
  const stem = `rirekisho${resume.pdfPaperFormat === 'a3-landscape' ? '-a3' : ''}${data.accommodationSections.length ? '-and-accommodation' : ''}`;
  downloadBlob(blob, `${stem}.${format}`);
}
