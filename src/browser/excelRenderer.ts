import ExcelJS from 'exceljs';
import { getTextAlignment } from '../lib/alignment';
import type { AccommodationData, ResumeData, TextAlignment } from '../lib/types';
import type { OfficeDatedRow, OfficeExportData, OfficeField, OfficeResumePage } from '../lib/officeExportData';

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
};
const SHADE: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECEF' } };
const fontName = (resume: ResumeData) => resume.pdfFontFamily === 'mincho' ? 'Yu Mincho' : 'Yu Gothic';

function put(sheet: ExcelJS.Worksheet, row: number, first: number, last: number, value: string, options: {
  font: string;
  shaded?: boolean;
  bold?: boolean;
  alignment?: TextAlignment;
  size?: number;
}): void {
  if (last > first) sheet.mergeCells(row, first, row, last);
  const anchor = sheet.getCell(row, first);
  anchor.value = value;
  anchor.numFmt = '@';
  anchor.font = { name: options.font, size: options.size ?? 10, bold: options.bold };
  anchor.alignment = { horizontal: options.alignment ?? 'left', vertical: 'middle', wrapText: true };
  for (let col = first; col <= last; col += 1) {
    const part = sheet.getCell(row, col);
    part.border = BORDER;
    if (options.shaded) part.fill = SHADE;
  }
}

function title(sheet: ExcelJS.Worksheet, left: number, name: string, date: string, font: string): void {
  put(sheet, 1, left, left + 5, name, { font, bold: true, size: 18 });
  put(sheet, 1, left + 6, left + 7, date, { font, size: 8, alignment: 'right' });
  sheet.getRow(1).height = 32;
}

function field(sheet: ExcelJS.Worksheet, row: number, first: number, last: number, value: OfficeField, font: string, shaded: boolean): void {
  put(sheet, row, first, first + 1, value.label, { font, shaded, bold: true, size: 9 });
  put(sheet, row, first + 2, last, value.value, { font, alignment: value.alignment });
  sheet.getRow(row).height = Math.max(sheet.getRow(row).height ?? 0, 25);
}

function profile(sheet: ExcelJS.Worksheet, start: number, data: OfficeExportData, font: string, shaded: boolean, workbook: ExcelJS.Workbook): void {
  const [furigana, name, birthDate, age] = data.profile;
  const gender = data.profile.find((item) => item.label === '性別');
  field(sheet, 3, start, start + 5, furigana, font, shaded);
  field(sheet, 4, start, start + 5, name, font, shaded);
  field(sheet, 5, start, start + 5, birthDate, font, shaded);
  put(sheet, 6, start, start + 1, age.label, { font, shaded, bold: true, size: 9 });
  put(sheet, 6, start + 2, start + 3, age.value, { font, alignment: age.alignment });
  if (gender) {
    put(sheet, 6, start + 4, start + 5, gender.label, { font, shaded, bold: true, size: 9 });
    put(sheet, 6, start + 6, start + 7, gender.value, { font, alignment: gender.alignment });
  } else {
    put(sheet, 6, start + 4, start + 7, '', { font });
  }
  sheet.getRow(6).height = 25;
  sheet.mergeCells(3, start + 6, 5, start + 7);
  const photoCell = sheet.getCell(3, start + 6);
  photoCell.border = BORDER;
  if (data.photoDataUrl) {
    const match = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.exec(data.photoDataUrl);
    if (!match) throw new Error('写真データをExcelへ埋め込めませんでした。');
    const imageId = workbook.addImage({ base64: data.photoDataUrl, extension: match[1] === 'jpeg' ? 'jpeg' : 'png' });
    sheet.addImage(imageId, { tl: { col: start + 5, row: 2 }, ext: { width: 76, height: 90 } });
  } else {
    photoCell.value = '写真';
    photoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  field(sheet, 7, start, start + 7, data.contact[0], font, shaded);
  put(sheet, 8, start, start + 1, data.contact[1].label, { font, shaded, bold: true, size: 9 });
  put(sheet, 8, start + 2, start + 3, data.contact[1].value, { font });
  put(sheet, 8, start + 4, start + 5, data.contact[2].label, { font, shaded, bold: true, size: 9 });
  put(sheet, 8, start + 6, start + 7, data.contact[2].value, { font });
  sheet.getRow(8).height = 25;
  field(sheet, 9, start, start + 7, data.contact[3], font, shaded);
  field(sheet, 10, start, start + 7, data.contact[4], font, shaded);
}

function history(sheet: ExcelJS.Worksheet, startRow: number, startCol: number, titleText: string, rows: OfficeDatedRow[], minRows: number, font: string, shaded: boolean): number {
  const lastCol = startCol + 7;
  put(sheet, startRow, startCol, lastCol, titleText, { font, bold: true, shaded });
  put(sheet, startRow + 1, startCol, startCol, '年', { font, bold: true, shaded, alignment: 'center' });
  put(sheet, startRow + 1, startCol + 1, startCol + 1, '月', { font, bold: true, shaded, alignment: 'center' });
  put(sheet, startRow + 1, startCol + 2, lastCol, '内容', { font, bold: true, shaded });
  let rowNumber = startRow + 2;
  for (let index = 0; index < Math.max(minRows, rows.length); index += 1) {
    const dated = rows[index];
    put(sheet, rowNumber, startCol, startCol, dated?.year.value ?? '', { font, alignment: dated?.year.alignment });
    put(sheet, rowNumber, startCol + 1, startCol + 1, dated?.month.value ?? '', { font, alignment: dated?.month.alignment });
    put(sheet, rowNumber, startCol + 2, lastCol, dated?.text.value ?? '', { font, alignment: dated?.text.alignment });
    sheet.getRow(rowNumber).height = Math.max(sheet.getRow(rowNumber).height ?? 0, 21);
    rowNumber += 1;
  }
  return rowNumber;
}

function textBox(sheet: ExcelJS.Worksheet, row: number, start: number, value: OfficeField, font: string, shaded: boolean): number {
  put(sheet, row, start, start + 7, value.label, { font, bold: true, shaded });
  const chunks = value.value.match(/[\s\S]{1,400}/g) ?? [''];
  let bodyRow = row + 1;
  for (const [index, chunk] of chunks.entries()) {
    if (index > 0) put(sheet, bodyRow++, start, start + 7, `${value.label}（続き）`, { font, bold: true, shaded });
    put(sheet, bodyRow, start, start + 7, chunk, { font, alignment: value.alignment });
    const lineCount = chunk.split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(Array.from(line).length / 25)), 0);
    sheet.getRow(bodyRow).height = Math.min(380, Math.max(40, (lineCount + 1) * 15));
    bodyRow += 1;
  }
  return bodyRow;
}

function mini(sheet: ExcelJS.Worksheet, startRow: number, startCol: number, fields: OfficeField[], font: string, shaded: boolean): number {
  for (let index = 0; index < 4; index += 1) {
    const col = startCol + (index % 2) * 4;
    const row = startRow + Math.floor(index / 2);
    put(sheet, row, col, col + 1, fields[index].label, { font, shaded, bold: true });
    put(sheet, row, col + 2, col + 3, fields[index].value, { font, alignment: fields[index].alignment });
    sheet.getRow(row).height = Math.max(sheet.getRow(row).height ?? 0, 28);
  }
  return startRow + 2;
}

function details(sheet: ExcelJS.Worksheet, startRow: number, startCol: number, data: OfficeExportData, font: string, shaded: boolean): number {
  const qualificationBlanks = data.appeals.some((field) => field.value.length > 200)
    ? 0
    : (data.paperFormat === 'a3-landscape' ? 3 : 5);
  let row = history(sheet, startRow, startCol, '免許・資格', data.qualifications,
    data.qualifications.length + qualificationBlanks, font, shaded) + 1;
  for (const appeal of data.appeals) row = textBox(sheet, row, startCol, appeal, font, shaded) + 1;
  put(sheet, row++, startCol, startCol + 7, '通勤・扶養', { font, bold: true, shaded });
  return mini(sheet, row, startCol, data.mini, font, shaded);
}

function sheetForPage(workbook: ExcelJS.Workbook, page: OfficeResumePage, data: OfficeExportData, resume: ResumeData, index: number): void {
  const isA3 = data.paperFormat === 'a3-landscape';
  const name = isA3 ? `履歴書${index ? ` ${index + 1}` : ''}` : `履歴書 ${index + 1}`;
  const sheet = workbook.addWorksheet(name, { pageSetup: {
    paperSize: (isA3 ? 8 : 9) as ExcelJS.PaperSize,
    orientation: isA3 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: page.kind === 'continuation' || data.appeals.some((field) => field.value.length > 350) ? 0 : 1,
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0, footer: 0 },
  } });
  const font = fontName(resume);
  const lastCol = isA3 ? 17 : 8;
  for (let col = 1; col <= lastCol; col += 1) sheet.getColumn(col).width = col === 9 && isA3 ? 3 : 8;
  const shaded = !isA3;
  let lastRow = 1;
  if (page.kind === 'a3') {
    title(sheet, 1, '履歴書', `作成日: ${data.printDate}`, font);
    profile(sheet, 1, data, font, false, workbook);
    const leftEnd = history(sheet, 12, 1, '学歴・職歴', page.historyLeft, 22, font, false);
    const rightEnd = history(sheet, 3, 10, '学歴・職歴（続き）', page.historyRight, 7, font, false);
    lastRow = Math.max(leftEnd, details(sheet, rightEnd + 1, 10, data, font, false));
  } else if (page.kind === 'a4-first') {
    title(sheet, 1, '履歴書', `作成日: ${data.printDate}  1/${data.pages.length}`, font);
    profile(sheet, 1, data, font, shaded, workbook);
    lastRow = history(sheet, 12, 1, '学歴・職歴', page.historyLeft, 21, font, shaded);
  } else if (page.kind === 'a4-second') {
    title(sheet, 1, '履歴書', `2/${data.pages.length}`, font);
    const historyEnd = history(sheet, 3, 1, '学歴・職歴（続き）', page.historyLeft, 5, font, shaded);
    lastRow = details(sheet, historyEnd + 1, 1, data, font, shaded);
  } else {
    title(sheet, 1, '履歴書（続き）', `${index + 1}/${data.pages.length}`, font);
    lastRow = history(sheet, 3, 1, '学歴・職歴（続き）', page.historyLeft, 0, font, shaded);
  }
  const lastLetter = sheet.getColumn(lastCol).letter;
  sheet.pageSetup.printArea = `A1:${lastLetter}${lastRow - 1}`;
  sheet.pageSetup.horizontalCentered = true;
  sheet.views = [{ state: 'normal', showGridLines: false }];
}

function accommodationSheets(workbook: ExcelJS.Workbook, data: OfficeExportData, resume: ResumeData, accommodation: AccommodationData): void {
  data.accommodationPages?.forEach((page) => {
    const sheet = workbook.addWorksheet(`配慮事項 ${page.pageNumber}`, { pageSetup: {
      paperSize: 9 as ExcelJS.PaperSize, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0, footer: 0 },
    } });
    const font = fontName(resume);
    for (let col = 1; col <= 8; col += 1) sheet.getColumn(col).width = 8;
    title(sheet, 1, '就労上の配慮事項シート', `${page.pageNumber}/${data.accommodationPages!.length}`, font);
    let row = 3;
    if (page.showNote) {
      put(sheet, row++, 1, 8, 'この書類は、応募先へ伝える必要がある範囲だけを本人が選んで作成する補助資料です。', { font });
      sheet.getRow(row - 1).height = 40;
    }
    for (const section of page.sections) {
      if (section.type === 'empty') put(sheet, row++, 1, 8, '出力対象の項目がありません。', { font });
      else row = textBox(sheet, row, 1, {
        label: `${section.label}${section.continued ? '（続き）' : ''}`,
        value: section.value,
        alignment: getTextAlignment(accommodation.textAlignments, section.fieldKey),
      }, font, true) + 1;
    }
    sheet.pageSetup.printArea = `A1:H${row - 1}`;
    sheet.views = [{ state: 'normal', showGridLines: false }];
  });
}

export async function createExcelDocument(data: OfficeExportData, resume: ResumeData, accommodation: AccommodationData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  data.pages.forEach((page, index) => sheetForPage(workbook, page, data, resume, index));
  accommodationSheets(workbook, data, resume, accommodation);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
