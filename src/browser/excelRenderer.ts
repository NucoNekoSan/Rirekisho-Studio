import ExcelJS from 'exceljs';
import { getTextAlignment } from '../lib/alignment';
import type { AccommodationData, ResumeData, TextAlignment } from '../lib/types';
import type { OfficeDatedRow, OfficeExportData, OfficeField, OfficeResumePage } from '../lib/officeExportData';
import { OFFICE_A4, mmToPoints } from '../lib/officeLayout';

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
};
const SHADE: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${OFFICE_A4.labelFill}` } };
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

function title(sheet: ExcelJS.Worksheet, left: number, name: string, date: string, font: string, span = 8): void {
  const split = span === 10 ? 7 : 6;
  put(sheet, 1, left, left + split - 1, span === 10 ? '履 歴 書' : name, { font, size: span === 10 ? 23 : 18 });
  put(sheet, 1, left + split, left + span - 1, date, { font, size: 8, alignment: 'right' });
  if (span === 10) {
    for (let col = left; col < left + span; col += 1) sheet.getCell(1, col).border = { bottom: { style: 'medium' } };
    sheet.getRow(1).height = mmToPoints(OFFICE_A4.titleHeight);
    sheet.getRow(2).height = mmToPoints(7);
  } else sheet.getRow(1).height = 32;
}

function field(sheet: ExcelJS.Worksheet, row: number, first: number, last: number, value: OfficeField, font: string, shaded: boolean): void {
  put(sheet, row, first, first + 1, value.label, { font, shaded, bold: true, size: 9 });
  put(sheet, row, first + 2, last, value.value, { font, alignment: value.alignment });
  sheet.getRow(row).height = Math.max(sheet.getRow(row).height ?? 0, 25);
}

function profile(sheet: ExcelJS.Worksheet, start: number, data: OfficeExportData, font: string, shaded: boolean, workbook: ExcelJS.Workbook): void {
  if (data.paperFormat === 'a4-portrait') {
    const [furigana, name, birthDate, age] = data.profile;
    const gender = data.profile.find((item) => item.label === '性別');
    for (const [row, item] of [[3, furigana], [4, name]] as const) {
      put(sheet, row, start, start + 1, item.label, { font, shaded, size: 9 });
      put(sheet, row, start + 2, start + 7, item.value, { font, alignment: item.alignment, size: row === 4 ? 17 : 10 });
    }
    put(sheet, 5, start, start, birthDate.label, { font, shaded, size: 9 });
    if (gender) {
      put(sheet, 5, start + 1, start + 3, birthDate.value, { font, alignment: birthDate.alignment });
      put(sheet, 5, start + 4, start + 4, age.label, { font, shaded, size: 9 });
      put(sheet, 5, start + 5, start + 5, age.value, { font, alignment: age.alignment });
      put(sheet, 5, start + 6, start + 6, gender.label, { font, shaded, size: 9 });
      put(sheet, 5, start + 7, start + 7, gender.value, { font, alignment: gender.alignment });
    } else {
      put(sheet, 5, start + 1, start + 5, birthDate.value, { font, alignment: birthDate.alignment });
      put(sheet, 5, start + 6, start + 6, age.label, { font, shaded, size: 9 });
      put(sheet, 5, start + 7, start + 7, age.value, { font, alignment: age.alignment });
    }
    sheet.getRow(3).height = mmToPoints(8);
    sheet.getRow(4).height = mmToPoints(21);
    sheet.getRow(5).height = mmToPoints(15);
    sheet.getRow(6).height = mmToPoints(4);
    sheet.mergeCells(3, start + 8, 5, start + 9);
    const photoCell = sheet.getCell(3, start + 8);
    photoCell.border = BORDER;
    if (data.photoDataUrl) {
      const match = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.exec(data.photoDataUrl);
      if (!match) throw new Error('写真データをExcelへ埋め込めませんでした。');
      const imageId = workbook.addImage({ base64: data.photoDataUrl, extension: match[1] === 'jpeg' ? 'jpeg' : 'png' });
      sheet.addImage(imageId, { tl: { col: start + 7, row: 2 }, ext: { width: 112, height: 150 } });
    } else {
      photoCell.value = '写真';
      photoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    field(sheet, 7, start, start + 9, data.contact[0], font, shaded);
    put(sheet, 8, start, start + 1, data.contact[1].label, { font, shaded, size: 9 });
    put(sheet, 8, start + 2, start + 4, data.contact[1].value, { font });
    put(sheet, 8, start + 5, start + 6, data.contact[2].label, { font, shaded, size: 9 });
    put(sheet, 8, start + 7, start + 9, data.contact[2].value, { font });
    field(sheet, 9, start, start + 9, data.contact[3], font, shaded);
    field(sheet, 10, start, start + 9, data.contact[4], font, shaded);
    for (let row = 7; row <= 10; row += 1) sheet.getRow(row).height = mmToPoints(10);
    sheet.getRow(11).height = mmToPoints(5);
    return;
  }
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

function history(sheet: ExcelJS.Worksheet, startRow: number, startCol: number, titleText: string, rows: OfficeDatedRow[], minRows: number, font: string, shaded: boolean, span = 8, qualification = false): number {
  const lastCol = startCol + span - 1;
  put(sheet, startRow, startCol, lastCol, titleText, { font, bold: true, shaded });
  put(sheet, startRow + 1, startCol, startCol, '年', { font, bold: true, shaded, alignment: 'center' });
  put(sheet, startRow + 1, startCol + 1, startCol + 1, '月', { font, bold: true, shaded, alignment: 'center' });
  put(sheet, startRow + 1, startCol + 2, lastCol, '内容', { font, bold: true, shaded });
  if (span === 10) {
    sheet.getRow(startRow).height = mmToPoints(OFFICE_A4.historyHeadingHeight);
    sheet.getRow(startRow + 1).height = mmToPoints(OFFICE_A4.historyHeaderHeight);
  }
  let rowNumber = startRow + 2;
  for (let index = 0; index < Math.max(minRows, rows.length); index += 1) {
    const dated = rows[index];
    put(sheet, rowNumber, startCol, startCol, dated?.year.value ?? '', { font, alignment: dated?.year.alignment });
    put(sheet, rowNumber, startCol + 1, startCol + 1, dated?.month.value ?? '', { font, alignment: dated?.month.alignment });
    put(sheet, rowNumber, startCol + 2, lastCol, dated?.text.value ?? '', { font, alignment: dated?.text.alignment });
    const baseHeight = span === 10
      ? mmToPoints((qualification ? OFFICE_A4.qualificationRowHeight * 1.16 : OFFICE_A4.historyRowHeight * 1.13))
      : Math.max(sheet.getRow(rowNumber).height ?? 0, 21);
    const lines = dated?.text.value.split(/\r?\n/).reduce((count, line) =>
      count + Math.max(1, Math.ceil(Array.from(line).length / 40)), 0) ?? 1;
    sheet.getRow(rowNumber).height = Math.max(baseHeight, lines * 15 + 2);
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

function a4TextBox(sheet: ExcelJS.Worksheet, row: number, value: OfficeField, font: string, heightMm: number): number {
  put(sheet, row, 1, 10, value.label, { font, shaded: true });
  put(sheet, row + 1, 1, 10, value.value, { font, alignment: value.alignment, size: 9 });
  sheet.getRow(row).height = mmToPoints(OFFICE_A4.textHeadingHeight);
  const lines = value.value.split(/\r?\n/).reduce((count, line) => count + Math.max(1, Math.ceil(Array.from(line).length / 38)), 0);
  sheet.getRow(row + 1).height = Math.max(mmToPoints(heightMm - OFFICE_A4.textHeadingHeight), (lines + 1) * 13);
  return row + 2;
}

function a4Details(sheet: ExcelJS.Worksheet, data: OfficeExportData, font: string): number {
  let row = history(sheet, 11, 1, '免許・資格', data.qualifications,
    Math.max(6, data.qualifications.length), font, true, 10, true);
  sheet.getRow(row++).height = mmToPoints(4);
  row = a4TextBox(sheet, row, data.appeals[0], font, OFFICE_A4.motivationHeight - 6);
  sheet.getRow(row++).height = mmToPoints(4);
  row = a4TextBox(sheet, row, data.appeals[1], font, OFFICE_A4.selfPrHeight + 15);
  sheet.getRow(row++).height = mmToPoints(4);
  row = a4TextBox(sheet, row, data.appeals[2], font, OFFICE_A4.requestsHeight + 2);
  sheet.getRow(row++).height = mmToPoints(4);
  for (let index = 0; index < 4; index += 2) {
    put(sheet, row, 1, 5, data.mini[index].label, { font, shaded: true });
    put(sheet, row, 6, 10, data.mini[index + 1].label, { font, shaded: true });
    sheet.getRow(row++).height = mmToPoints(4);
    put(sheet, row, 1, 5, data.mini[index].value, { font, alignment: data.mini[index].alignment });
    put(sheet, row, 6, 10, data.mini[index + 1].value, { font, alignment: data.mini[index + 1].alignment });
    sheet.getRow(row++).height = mmToPoints(11);
  }
  return row;
}

function a3TextBox(sheet: ExcelJS.Worksheet, headingRow: number, bodyRows: number, field: OfficeField, font: string): void {
  put(sheet, headingRow, 10, 17, field.label, { font, size: 9 });
  const firstBodyRow = headingRow + 1;
  const lastBodyRow = headingRow + bodyRows;
  sheet.mergeCells(firstBodyRow, 10, lastBodyRow, 17);
  const anchor = sheet.getCell(firstBodyRow, 10);
  anchor.value = field.value;
  anchor.numFmt = '@';
  anchor.font = { name: font, size: 8 };
  anchor.alignment = { horizontal: field.alignment, vertical: 'top', wrapText: true };
  anchor.border = BORDER;
}

function a3Details(sheet: ExcelJS.Worksheet, data: OfficeExportData, font: string): number {
  const qualificationEnd = history(sheet, 13, 10, '免許・資格', data.qualifications,
    data.qualifications.length + 3, font, false);
  let row = Math.max(22, qualificationEnd + 1);
  for (const [index, field] of data.appeals.entries()) {
    const bodyRows = Math.max(index === 2 ? 1 : 4, Math.ceil(field.value.length / 90));
    a3TextBox(sheet, row, bodyRows, field, font);
    row += bodyRows + 1;
  }
  for (let index = 0; index < 4; index += 2) {
    put(sheet, row, 10, 13, data.mini[index].label, { font, size: 8 });
    put(sheet, row, 14, 17, data.mini[index + 1].label, { font, size: 8 });
    put(sheet, row + 1, 10, 13, data.mini[index].value, { font, size: 8, alignment: data.mini[index].alignment });
    put(sheet, row + 1, 14, 17, data.mini[index + 1].value, { font, size: 8, alignment: data.mini[index + 1].alignment });
    row += 2;
  }
  return row;
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
    margins: { left: 0.43, right: 0.43, top: page.kind === 'a4-second' ? 0.24 : 0.43,
      bottom: 0.43, header: 0, footer: 0 },
  } });
  const font = fontName(resume);
  const lastCol = isA3 ? 17 : 10;
  const a4Widths = [9, 7, 11, 11, 11, 11, 11, 10, 7.5, 7.5];
  const a3FaceWidths = [10, 8, 13, 13, 13, 13, 13, 12];
  for (let col = 1; col <= lastCol; col += 1) sheet.getColumn(col).width = isA3
    ? (col === 9 ? 3 : a3FaceWidths[(col - 1) % 9]) : a4Widths[col - 1];
  const shaded = !isA3;
  let lastRow = 1;
  if (page.kind === 'a3') {
    title(sheet, 1, '履歴書', `作成日: ${data.printDate}`, font);
    profile(sheet, 1, data, font, false, workbook);
    const leftEnd = history(sheet, 12, 1, '学歴・職歴', page.historyLeft, 22, font, false);
    history(sheet, 3, 10, '学歴・職歴（続き）', page.historyRight, 7, font, false);
    lastRow = Math.max(leftEnd, a3Details(sheet, data, font));
    for (let row = 3; row < lastRow; row += 1) sheet.getRow(row).height = Math.max(sheet.getRow(row).height ?? 0, 21);
  } else if (page.kind === 'a4-first') {
    title(sheet, 1, '履歴書', `作成日: ${data.printDate} / 1/${data.pages.length}`, font, 10);
    profile(sheet, 1, data, font, shaded, workbook);
    lastRow = history(sheet, 12, 1, '学歴・職歴', page.historyLeft, 21, font, shaded, 10);
  } else if (page.kind === 'a4-second') {
    put(sheet, 1, 8, 10, `2/${data.pages.length}`, { font, size: 8, alignment: 'right' });
    for (let col = 8; col <= 10; col += 1) sheet.getCell(1, col).border = {};
    sheet.getRow(1).height = mmToPoints(5);
    sheet.getRow(2).height = 1;
    const historyEnd = history(sheet, 3, 1, '学歴・職歴', page.historyLeft, 5, font, shaded, 10);
    sheet.getRow(historyEnd).height = mmToPoints(6.5);
    lastRow = a4Details(sheet, data, font);
  } else {
    const span = isA3 ? 17 : 10;
    title(sheet, 1, '履歴書（続き）', `${index + 1}/${data.pages.length}`, font, span);
    lastRow = history(sheet, 3, 1, '学歴・職歴（続き）', page.historyLeft, 0, font, shaded, span);
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
