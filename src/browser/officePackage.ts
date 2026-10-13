import JSZip from 'jszip';
import { buildProjectFile, parseProjectFileDocument, type ParsedProjectFile } from '../lib/projectFile';
import { buildOfficeExportData, type OfficeDatedRow, type OfficeField } from '../lib/officeExportData';
import { officeAnchor } from '../lib/officeAnchor';
import { createDefaultAccommodation } from '../lib/defaults';
import { processPhotoFile } from './photoLoader';
import type { AppState, HistoryEntry, OfficeSource, ProjectFile, QualificationEntry } from '../lib/types';

const PART = 'customXml/rirekishoStudio.xml';
const EXCEL_SHEET = '_RirekishoStudio';
const MAX_FILE_BYTES = 25_000_000;
const MAX_PART_BYTES = 20_000_000;
const XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

interface OfficeManifest {
  app: 'Rirekisho Studio';
  version: 1;
  format: OfficeSource['format'];
  printedAccommodation: boolean;
  privateData: boolean;
  project: ProjectFile;
  values: Record<string, string>;
}

const utf8Base64 = (value: string) => btoa(Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join(''));
const fromUtf8Base64 = (value: string) => new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
const bytesToBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

function fieldsForState(state: AppState, includeAccommodation: boolean): Record<string, string> {
  const data = buildOfficeExportData(state.resume, state.accommodation, includeAccommodation);
  const fields: OfficeField[] = [...data.profile, ...data.contact, ...data.appeals, ...data.mini];
  const rows = (entries: OfficeDatedRow[]) => entries.flatMap((row) => [row.year, row.month, row.text]);
  fields.push(...rows(data.qualifications));
  for (const page of data.pages) fields.push(...rows(page.historyLeft), ...rows(page.historyRight));
  for (const page of data.accommodationPages ?? []) {
    for (const section of page.sections) if (section.type !== 'empty' && !section.continued) {
      fields.push({ key: section.fieldKey, label: section.label, value: section.value, alignment: 'left' });
    }
  }
  return Object.fromEntries(fields.filter((field) => field.key).map((field) => [field.key, field.value]));
}

function createManifest(format: OfficeSource['format'], state: AppState, includeAccommodation: boolean, includePrivateData: boolean): OfficeManifest {
  const project = buildProjectFile(structuredClone(state), true);
  if (!includePrivateData) {
    project.state.resume.memo = '';
    project.includeAccommodation = includeAccommodation && project.includeAccommodation;
    if (!project.includeAccommodation) project.state.accommodation = createDefaultAccommodation();
    else {
      const accommodation = project.state.accommodation;
      if (!accommodation.includeDisabilityName) accommodation.disabilityName = '';
      if (!accommodation.includeCertificate) accommodation.certificate = '';
      if (!accommodation.includeHospitalVisit) accommodation.hospitalVisit = '';
      if (!accommodation.includeMedication) accommodation.medication = '';
      if (!accommodation.includeSupportContact) accommodation.supportContact = '';
    }
  } else {
    project.includeAccommodation = true;
    project.state.accommodation = state.accommodation;
  }
  return { app: 'Rirekisho Studio', version: 1, format, printedAccommodation: includeAccommodation,
    privateData: includePrivateData, project, values: fieldsForState(state, includeAccommodation) };
}

function addRelationship(xml: string, target: string): string {
  const id = `rIdRirekishoStudio${Date.now()}`;
  const relationship = `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="${target}"/>`;
  if (!xml.includes('</Relationships>')) throw new Error('Officeファイルの構造が不正です。');
  return xml.replace('</Relationships>', `${relationship}</Relationships>`);
}

export async function attachOfficeManifest(blob: Blob, format: OfficeSource['format'], state: AppState, includeAccommodation: boolean, includePrivateData: boolean): Promise<Blob> {
  const manifest = createManifest(format, state, includeAccommodation, includePrivateData);
  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer() as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.addWorksheet(EXCEL_SHEET);
    sheet.state = 'veryHidden';
    const value = utf8Base64(JSON.stringify(manifest));
    for (let offset = 0, row = 1; offset < value.length; offset += 30_000, row += 1) {
      sheet.getCell(row, 1).value = value.slice(offset, offset + 30_000);
    }
    return new Blob([await workbook.xlsx.writeBuffer() as ArrayBuffer], { type: blob.type });
  }
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  zip.file(PART, `<rirekishoStudio version="1">${utf8Base64(JSON.stringify(manifest))}</rirekishoStudio>`);
  const relPath = format === 'docx' ? 'word/_rels/document.xml.rels' : 'xl/_rels/workbook.xml.rels';
  const relationship = zip.file(relPath);
  if (!relationship) throw new Error('Officeファイルの構造が不正です。');
  zip.file(relPath, addRelationship(await relationship.async('string'), '../customXml/rirekishoStudio.xml'));
  const output = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return new Blob([output], { type: blob.type });
}

async function readZip(file: Blob): Promise<JSZip> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Officeファイルが大きすぎます（上限25 MB）。');
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = buffer.byteLength - 22; offset >= Math.max(0, buffer.byteLength - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('OfficeファイルのZIP構造が不正です。');
  const count = view.getUint16(eocd + 10, true);
  if (count > 3000) throw new Error('Officeファイルの内容が多すぎます。');
  let offset = view.getUint32(eocd + 16, true);
  let expandedBytes = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('OfficeファイルのZIP構造が不正です。');
    }
    const size = view.getUint32(offset + 24, true);
    expandedBytes += size;
    if (size > MAX_PART_BYTES || expandedBytes > 80_000_000) {
      throw new Error('Officeファイルの展開サイズが大きすぎます。');
    }
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer); }
  catch { throw new Error('Officeファイルを開けませんでした。'); }
  const entries = Object.values(zip.files);
  if (entries.length > 3000) throw new Error('Officeファイルの内容が多すぎます。');
  return zip;
}

async function readManifest(zip: JSZip, format: OfficeSource['format'], file: File): Promise<OfficeManifest> {
  let encoded: string;
  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer() as Parameters<typeof workbook.xlsx.load>[0]);
    if (workbook.worksheets.length > 20 || workbook.worksheets.some((sheet) => sheet.rowCount > 1000)) {
      throw new Error('Excelファイルの表が大きすぎます。');
    }
    const sheet = workbook.getWorksheet(EXCEL_SHEET);
    if (!sheet || sheet.state !== 'veryHidden') throw new Error('このExcelファイルは読込みに対応していません。新しく本アプリから書き出したファイルを選んでください。');
    encoded = Array.from({ length: sheet.rowCount }, (_, index) => String(sheet.getCell(index + 1, 1).value ?? '')).join('');
  } else {
    const part = zip.file(PART);
    if (!part) throw new Error('このWordファイルは読込みに対応していません。新しく本アプリから書き出したファイルを選んでください。');
    const xml = await part.async('string');
    if (xml.length > MAX_PART_BYTES) throw new Error('Officeファイルの復元情報が大きすぎます。');
    const match = /^<rirekishoStudio version="1">([A-Za-z0-9+/=]+)<\/rirekishoStudio>$/.exec(xml);
    if (!match) throw new Error('Officeファイルの復元情報が不正です。');
    encoded = match[1];
  }
  if (encoded.length > MAX_PART_BYTES) throw new Error('Officeファイルの復元情報が大きすぎます。');
  let value: unknown;
  try { value = JSON.parse(fromUtf8Base64(encoded)); }
  catch { throw new Error('Officeファイルの復元情報が不正です。'); }
  if (!value || typeof value !== 'object') throw new Error('Officeファイルの復元情報が不正です。');
  const manifest = value as OfficeManifest;
  if (manifest.app !== 'Rirekisho Studio' || manifest.version !== 1 || manifest.format !== format ||
    typeof manifest.privateData !== 'boolean' || typeof manifest.printedAccommodation !== 'boolean' ||
    !manifest.values || typeof manifest.values !== 'object' || !manifest.project) {
    throw new Error('対応していないOfficeファイルです。');
  }
  return manifest;
}

function parseXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('OfficeファイルのXMLが不正です。');
  return document;
}

function wordValues(document: Document, anchors: Set<string>): Map<string, string> {
  const values = new Map<string, string>();
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT);
  let active: { name: string; id: string; parts: string[]; paragraph: Element | null } | null = null;
  while (walker.nextNode()) {
    const element = walker.currentNode as Element;
    if (element.namespaceURI !== XML_NS) continue;
    if (element.localName === 'bookmarkStart') {
      const name = element.getAttributeNS(XML_NS, 'name') ?? element.getAttribute('w:name') ?? '';
      if (anchors.has(name)) active = { name, id: element.getAttributeNS(XML_NS, 'id') ?? element.getAttribute('w:id') ?? '', parts: [], paragraph: null };
    } else if (element.localName === 'bookmarkEnd' && active &&
      (element.getAttributeNS(XML_NS, 'id') ?? element.getAttribute('w:id')) === active.id) {
      values.set(active.name, active.parts.join('').trim() === '' ? '' : active.parts.join(''));
      active = null;
    } else if (element.localName === 't' && active) {
      const paragraph = element.closest('w\\:p') ?? element.parentElement?.parentElement ?? null;
      if (active.paragraph && paragraph !== active.paragraph) active.parts.push('\n');
      active.paragraph = paragraph;
      active.parts.push(element.textContent ?? '');
    }
  }
  return values;
}

const direct = (parent: Element, name: string): Element[] => Array.from(parent.children).filter((child) => child.namespaceURI === XML_NS && child.localName === name);
const wordCellText = (cell: Element): string => direct(cell, 'p').map((paragraph) =>
  Array.from(paragraph.getElementsByTagNameNS(XML_NS, 't'), (text) => text.textContent ?? '').join('')).join('\n').trim();

function wordRows(document: Document, state: AppState): void {
  let nextBookmarkId = Math.max(0, ...Array.from(document.getElementsByTagNameNS(XML_NS, 'bookmarkStart'),
    (mark) => Number(mark.getAttributeNS(XML_NS, 'id') ?? mark.getAttribute('w:id')) || 0)) + 1;
  const usedIds = new Set<string>();
  const known = new Map<string, { group: 'histories' | 'qualifications'; id: string }>();
  for (const group of ['histories', 'qualifications'] as const) {
    for (const row of state.resume[group]) known.set(officeAnchor(`${group}.${row.id}.text`), { group, id: row.id });
  }
  const result: { histories: HistoryEntry[]; qualifications: QualificationEntry[] } = { histories: [], qualifications: [] };
  const found = { histories: false, qualifications: false };
  const tables = Array.from(document.getElementsByTagNameNS(XML_NS, 'tbl'));
  for (const table of tables) {
    const rows = direct(table, 'tr');
    const marks = Array.from(table.getElementsByTagNameNS(XML_NS, 'bookmarkStart'));
    const rowMark = marks.map((mark) => known.get(mark.getAttributeNS(XML_NS, 'name') ?? mark.getAttribute('w:name') ?? '')).find(Boolean);
    const heading = `${table.previousElementSibling?.textContent ?? ''} ${rows.slice(0, 2).flatMap((row) => direct(row, 'tc').map(wordCellText)).join(' ')}`;
    const group = rowMark?.group ?? (heading.includes('免許・資格') ? 'qualifications' : heading.includes('学歴・職歴') ? 'histories' : null);
    if (!group) continue;
    found[group] = true;
    for (const row of rows) {
      const cells = direct(row, 'tc');
      if (cells.length !== 3) continue;
      if (cells.some((cell) => cell.getElementsByTagNameNS(XML_NS, 'tbl').length > 0)) continue;
      const [year, month, text] = cells.map(wordCellText);
      if ((year === '年' && month === '月') || (!year && !month && !text)) continue;
      if (text.includes('学歴・職歴') || text.includes('免許・資格')) continue;
      const bookmark = Array.from(row.getElementsByTagNameNS(XML_NS, 'bookmarkStart'))
        .map((mark) => known.get(mark.getAttributeNS(XML_NS, 'name') ?? mark.getAttribute('w:name') ?? ''))
        .find((item) => item?.group === group);
      const id = bookmark && !usedIds.has(bookmark.id) ? bookmark.id : crypto.randomUUID();
      usedIds.add(id);
      if (!bookmark || id !== bookmark.id) {
        for (const [index, field] of (['year', 'month', 'text'] as const).entries()) {
          const paragraph = direct(cells[index], 'p')[0];
          if (!paragraph) continue;
          const numericId = String(nextBookmarkId++);
          const start = document.createElementNS(XML_NS, 'w:bookmarkStart');
          start.setAttributeNS(XML_NS, 'w:id', numericId);
          start.setAttributeNS(XML_NS, 'w:name', officeAnchor(`${group}.${id}.${field}`));
          const end = document.createElementNS(XML_NS, 'w:bookmarkEnd');
          end.setAttributeNS(XML_NS, 'w:id', numericId);
          paragraph.insertBefore(start, paragraph.firstChild);
          paragraph.appendChild(end);
        }
      }
      result[group].push({ id, year, month, text });
    }
  }
  for (const group of ['histories', 'qualifications'] as const) {
    if (found[group]) state.resume[group] = result[group];
  }
}

function excelRows(workbook: import('exceljs').Workbook, state: AppState): void {
  const known = new Map<string, string>();
  for (const group of ['histories', 'qualifications'] as const) {
    for (const row of state.resume[group]) {
      for (const range of workbook.definedNames.getRanges(officeAnchor(`${group}.${row.id}.text`)).ranges) {
        known.set(range.replace(/['$]/g, ''), row.id);
      }
    }
  }
  const result: { histories: HistoryEntry[]; qualifications: QualificationEntry[] } = { histories: [], qualifications: [] };
  const found = { histories: false, qualifications: false };
  for (const sheet of workbook.worksheets) {
    if (sheet.name === EXCEL_SHEET) continue;
    const sections: Array<{ row: number; col: number; group: 'histories' | 'qualifications' }> = [];
    for (let row = 1; row <= sheet.rowCount; row += 1) {
      for (const col of sheet.pageSetup.orientation === 'landscape' ? [1, 10] : [1]) {
        const cell = sheet.getCell(row, col);
        if (cell.isMerged && cell.master.address !== cell.address) continue;
        const label = cell.text;
        if (/^学歴・職歴(?:（続き）)?$/.test(label)) sections.push({ row, col, group: 'histories' });
        if (label === '免許・資格') sections.push({ row, col, group: 'qualifications' });
      }
    }
    for (const section of sections.sort((left, right) => left.col - right.col || left.row - right.row)) {
      found[section.group] = true;
      const next = sections.filter((item) => item.col === section.col && item.row > section.row)
        .reduce((minimum, item) => Math.min(minimum, item.row), sheet.rowCount + 1);
      for (let row = section.row + 2; row < next; row += 1) {
        const year = sheet.getCell(row, section.col).text.trim();
        const month = sheet.getCell(row, section.col + 1).text.trim();
        const text = sheet.getCell(row, section.col + 2).text.trim();
        if (!year && !month && !text) continue;
        if (['志望動機', '自己PR', '本人希望欄', '通勤', '扶養'].includes(year)) break;
        const address = `${sheet.name}!${sheet.getCell(row, section.col + 2).address}`;
        const id = known.get(address) ?? crypto.randomUUID();
        if (!known.has(address)) {
          for (const [offset, field] of (['year', 'month', 'text'] as const).entries()) {
            sheet.getCell(row, section.col + offset).addName(officeAnchor(`${section.group}.${id}.${field}`));
          }
        }
        result[section.group].push({ id, year, month, text });
      }
    }
  }
  for (const group of ['histories', 'qualifications'] as const) {
    if (found[group]) state.resume[group] = result[group];
  }
}

function setByKey(state: AppState, key: string, value: string): void {
  const parts = key.split('.');
  if (parts[0] === 'basic' && parts.length === 2) {
    const field = parts[1];
    if (field === 'age') return;
    if (field === 'gender') {
      const genders: Record<string, typeof state.resume.basic.gender> = { '女性': 'female', '男性': 'male', '回答しない': 'no_answer', '': '' };
      if (!(value in genders)) throw new Error('Officeファイルの性別欄を読み取れませんでした。');
      state.resume.basic.gender = genders[value];
      return;
    }
    if (field === 'birthDate') {
      if (!value.trim()) { state.resume.basic.birthDate = ''; return; }
      const western = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(value);
      const japanese = /(令和|平成|昭和|大正|明治)(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(value);
      const base = { '令和': 2018, '平成': 1988, '昭和': 1925, '大正': 1911, '明治': 1867 };
      const year = western ? Number(western[1]) : japanese ? base[japanese[1] as keyof typeof base] + (japanese[2] === '元' ? 1 : Number(japanese[2])) : NaN;
      const month = Number(western?.[2] ?? japanese?.[3]);
      const day = Number(western?.[3] ?? japanese?.[4]);
      const date = new Date(year, month - 1, day);
      if (!Number.isFinite(year) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new Error('Officeファイルの生年月日を読み取れませんでした。');
      }
      state.resume.basic.birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return;
    }
    if (field === 'address' || field === 'contactAddress') {
      const match = /^〒?([0-9]{3})-?([0-9]{4})\s*(.*)$/.exec(value);
      if (match) {
        state.resume.basic[field === 'address' ? 'postalCode' : 'contactPostalCode'] = `${match[1]}${match[2]}`;
        state.resume.basic[field] = match[3];
      } else state.resume.basic[field] = value;
      return;
    }
    if (field in state.resume.basic) (state.resume.basic as unknown as Record<string, string>)[field] = value;
    return;
  }
  if ((parts[0] === 'histories' || parts[0] === 'qualifications') && parts.length === 3) {
    const row = state.resume[parts[0]].find((entry) => entry.id === parts[1]);
    if (row && (parts[2] === 'year' || parts[2] === 'month' || parts[2] === 'text')) row[parts[2]] = value;
    return;
  }
  if (parts[0] === 'resume' && parts.length === 2 && parts[1] in state.resume) {
    (state.resume as unknown as Record<string, unknown>)[parts[1]] = value;
    return;
  }
  if (parts.length === 1 && key in state.accommodation) {
    (state.accommodation as unknown as Record<string, unknown>)[key] = value;
  }
}

function setAlignment(state: AppState, key: string, alignment: string | undefined): void {
  if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') return;
  if (key in state.accommodation) state.accommodation.textAlignments[key] = alignment;
  else state.resume.textAlignments[key] = alignment;
}

function wordAlignment(document: Document, name: string): string | undefined {
  const marker = Array.from(document.getElementsByTagNameNS(XML_NS, 'bookmarkStart')).find((element) =>
    (element.getAttributeNS(XML_NS, 'name') ?? element.getAttribute('w:name')) === name);
  let paragraph = marker?.parentElement ?? null;
  while (paragraph && paragraph.localName !== 'p') paragraph = paragraph.parentElement;
  const properties = paragraph ? direct(paragraph, 'pPr')[0] : undefined;
  const justification = properties ? direct(properties, 'jc')[0] : undefined;
  return justification?.getAttributeNS(XML_NS, 'val') ?? justification?.getAttribute('w:val') ?? undefined;
}

async function readEditedPhoto(zip: JSZip, format: OfficeSource['format'], state: AppState): Promise<void> {
  const prefix = format === 'docx' ? 'word/media/' : 'xl/media/';
  const media = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith(prefix));
  if (media.length === 0) {
    state.resume.photo = null;
    return;
  }
  const photo = media[0];
  const bytes = new Uint8Array(await photo.async('arraybuffer'));
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error('Officeファイルの写真はJPG/JPEG形式にしてください。');
  }
  const encoded = bytesToBase64(bytes);
  if (state.resume.photo?.dataUrl === `data:image/jpeg;base64,${encoded}`) return;
  state.resume.photo = await processPhotoFile(new File([Uint8Array.from(bytes).buffer], 'office-photo.jpg', { type: 'image/jpeg' }));
}

export interface OfficeImportResult extends ParsedProjectFile { officeSource: OfficeSource; }

export async function importOfficeFile(file: File): Promise<OfficeImportResult> {
  const format = file.name.toLowerCase().endsWith('.docx') ? 'docx' : file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : null;
  if (!format) throw new Error('Word（.docx）またはExcel（.xlsx）ファイルを選んでください。');
  const zip = await readZip(file);
  const manifest = await readManifest(zip, format, file);
  const project = parseProjectFileDocument(JSON.stringify(manifest.project), true);
  const anchors = new Set(Object.keys(manifest.values).map(officeAnchor));
  const extracted = new Map<string, string>();
  let sourceBytes: Uint8Array<ArrayBuffer> | null = null;
  if (format === 'docx') {
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml || xml.length > MAX_PART_BYTES) throw new Error('Word本文が不正です。');
    const document = parseXml(xml);
    const values = wordValues(document, anchors);
    for (const key of Object.keys(manifest.values)) {
      const value = values.get(officeAnchor(key));
      if (value !== undefined) extracted.set(key, value);
      setAlignment(project.state, key, wordAlignment(document, officeAnchor(key)));
    }
    wordRows(document, project.state);
    zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
    sourceBytes = Uint8Array.from(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
  } else {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer() as Parameters<typeof workbook.xlsx.load>[0]);
    for (const key of Object.keys(manifest.values)) {
      const ranges = workbook.definedNames.getRanges(officeAnchor(key)).ranges;
      if (ranges.length !== 1) continue;
      const match = /^'?(.+?)'?!\$?([A-Z]+)\$?(\d+)$/.exec(ranges[0]);
      if (!match) continue;
      const cell = workbook.getWorksheet(match[1])?.getCell(`${match[2]}${match[3]}`);
      if (cell) {
        extracted.set(key, String(cell.text ?? ''));
        setAlignment(project.state, key, cell.alignment?.horizontal);
      }
    }
    excelRows(workbook, project.state);
    sourceBytes = new Uint8Array(await workbook.xlsx.writeBuffer() as ArrayBuffer);
  }
  const requiredKeys = Object.keys(manifest.values).filter((key) => !key.startsWith('histories.') && !key.startsWith('qualifications.'));
  if (requiredKeys.some((key) => !extracted.has(key))) throw new Error('Officeファイルの入力欄の識別情報が不足しています。');
  for (const [key, value] of extracted) if (value !== manifest.values[key]) setByKey(project.state, key, value);
  await readEditedPhoto(zip, format, project.state);
  const validated = parseProjectFileDocument(JSON.stringify({ ...manifest.project, state: project.state }), true);
  const refreshed = createManifest(format, validated.state, manifest.printedAccommodation, manifest.privateData);
  for (const [key, value] of extracted) if (key in refreshed.values) refreshed.values[key] = value;
  let finalizedBytes: Uint8Array<ArrayBuffer>;
  if (format === 'docx') {
    const refreshedZip = await JSZip.loadAsync(sourceBytes);
    refreshedZip.file(PART, `<rirekishoStudio version="1">${utf8Base64(JSON.stringify(refreshed))}</rirekishoStudio>`);
    finalizedBytes = Uint8Array.from(await refreshedZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
  } else {
    const { default: ExcelJS } = await import('exceljs');
    const refreshedWorkbook = new ExcelJS.Workbook();
    await refreshedWorkbook.xlsx.load(sourceBytes.buffer as ArrayBuffer as Parameters<typeof refreshedWorkbook.xlsx.load>[0]);
    const sheet = refreshedWorkbook.getWorksheet(EXCEL_SHEET)!;
    sheet.spliceRows(1, sheet.rowCount);
    const encoded = utf8Base64(JSON.stringify(refreshed));
    for (let offset = 0, row = 1; offset < encoded.length; offset += 30_000, row += 1) {
      sheet.getCell(row, 1).value = encoded.slice(offset, offset + 30_000);
    }
    finalizedBytes = new Uint8Array(await refreshedWorkbook.xlsx.writeBuffer() as ArrayBuffer);
  }
  return { ...validated, officeSource: { format, base64: bytesToBase64(finalizedBytes),
    paperFormat: validated.state.resume.pdfPaperFormat, printedAccommodation: manifest.printedAccommodation,
    hasPhoto: Object.keys(zip.files).some((name) => name.startsWith(format === 'docx' ? 'word/media/' : 'xl/media/')) } };
}

export function officeSourceAsBlob(source: OfficeSource): Blob {
  return new Blob([base64ToBytes(source.base64)], { type: source.format === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function updateWordValue(document: Document, name: string, value: string): void {
  const starts = Array.from(document.getElementsByTagNameNS(XML_NS, 'bookmarkStart'));
  const start = starts.find((element) => (element.getAttributeNS(XML_NS, 'name') ?? element.getAttribute('w:name')) === name);
  if (!start) return;
  const id = start.getAttributeNS(XML_NS, 'id') ?? start.getAttribute('w:id');
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT);
  walker.currentNode = start;
  let first: Element | null = null;
  while (walker.nextNode()) {
    const element = walker.currentNode as Element;
    if (element.namespaceURI !== XML_NS) continue;
    if (element.localName === 'bookmarkEnd' && (element.getAttributeNS(XML_NS, 'id') ?? element.getAttribute('w:id')) === id) break;
    if (element.localName === 't') {
      if (!first) first = element;
      else element.textContent = '';
    }
  }
  if (!first) return;
  const lines = value.split(/\r?\n/);
  first.textContent = lines[0] || ' ';
  first.setAttribute('xml:space', 'preserve');
  for (const line of lines.slice(1)) {
    const run = first.parentNode;
    if (!run) break;
    run.appendChild(document.createElementNS(XML_NS, 'w:br'));
    const text = document.createElementNS(XML_NS, 'w:t');
    text.setAttribute('xml:space', 'preserve');
    text.textContent = line || ' ';
    run.appendChild(text);
  }
}

function markWordRow(document: Document, row: Element, group: 'histories' | 'qualifications', id: string): void {
  const cells = direct(row, 'tc');
  const existingIds = Array.from(document.getElementsByTagNameNS(XML_NS, 'bookmarkStart'),
    (mark) => Number(mark.getAttributeNS(XML_NS, 'id') ?? mark.getAttribute('w:id')) || 0);
  let next = Math.max(0, ...existingIds) + 1;
  for (const [index, field] of (['year', 'month', 'text'] as const).entries()) {
    const paragraph = direct(cells[index], 'p')[0];
    if (!paragraph) continue;
    const numericId = String(next++);
    const start = document.createElementNS(XML_NS, 'w:bookmarkStart');
    start.setAttributeNS(XML_NS, 'w:id', numericId);
    start.setAttributeNS(XML_NS, 'w:name', officeAnchor(`${group}.${id}.${field}`));
    const end = document.createElementNS(XML_NS, 'w:bookmarkEnd');
    end.setAttributeNS(XML_NS, 'w:id', numericId);
    paragraph.insertBefore(start, paragraph.firstChild);
    paragraph.appendChild(end);
  }
}

function excelNamedCell(workbook: import('exceljs').Workbook, key: string): import('exceljs').Cell | null {
  const ranges = workbook.definedNames.getRanges(officeAnchor(key)).ranges;
  if (ranges.length !== 1) return null;
  const match = /^'?(.+?)'?!\$?([A-Z]+)\$?(\d+)$/.exec(ranges[0]);
  return match ? workbook.getWorksheet(match[1])?.getCell(`${match[2]}${match[3]}`) ?? null : null;
}

function syncExcelRows(workbook: import('exceljs').Workbook, before: AppState, after: AppState): void {
  for (const group of ['histories', 'qualifications'] as const) {
    const currentIds = new Set(after.resume[group].map((row) => row.id));
    for (const old of before.resume[group]) {
      if (currentIds.has(old.id)) continue;
      for (const field of ['year', 'month', 'text'] as const) {
        const cell = excelNamedCell(workbook, `${group}.${old.id}.${field}`);
        if (cell) { cell.value = ''; cell.removeName(officeAnchor(`${group}.${old.id}.${field}`)); }
      }
    }
    for (const entry of after.resume[group]) {
      if (excelNamedCell(workbook, `${group}.${entry.id}.text`)) continue;
      let assigned = false;
      for (const sheet of workbook.worksheets) {
        if (sheet.name === EXCEL_SHEET) continue;
        const columns = sheet.pageSetup.orientation === 'landscape' ? [1, 10] : [1];
        for (const col of columns) {
          for (let heading = 1; heading <= sheet.rowCount; heading += 1) {
            const headingCell = sheet.getCell(heading, col);
            if (headingCell.isMerged && headingCell.master.address !== headingCell.address) continue;
            const title = headingCell.text;
            if (group === 'histories' ? !/^学歴・職歴(?:（続き）)?$/.test(title) : title !== '免許・資格') continue;
            for (let row = heading + 2; row <= sheet.rowCount; row += 1) {
              const nextTitle = sheet.getCell(row, col).text;
              if (/^(学歴・職歴|免許・資格|志望動機|自己PR|本人希望欄)/.test(nextTitle)) break;
              if ([0, 1, 2].some((offset) => sheet.getCell(row, col + offset).text.trim())) continue;
              for (const [offset, field] of (['year', 'month', 'text'] as const).entries()) {
                const cell = sheet.getCell(row, col + offset);
                cell.value = entry[field];
                cell.addName(officeAnchor(`${group}.${entry.id}.${field}`));
              }
              assigned = true;
              break;
            }
            if (assigned) break;
          }
          if (assigned) break;
        }
        if (assigned) break;
      }
      if (!assigned) throw new Error('追加した行を元のExcel様式へ配置できません。用紙形式を切り替えて新しい様式で保存してください。');
    }
  }
}

function syncWordRows(document: Document, before: AppState, after: AppState): void {
  for (const group of ['histories', 'qualifications'] as const) {
    const currentIds = new Set(after.resume[group].map((row) => row.id));
    for (const old of before.resume[group]) {
      if (currentIds.has(old.id)) continue;
      const marker = Array.from(document.getElementsByTagNameNS(XML_NS, 'bookmarkStart')).find((item) =>
        (item.getAttributeNS(XML_NS, 'name') ?? item.getAttribute('w:name')) === officeAnchor(`${group}.${old.id}.text`));
      let ancestor = marker?.parentElement ?? null;
      while (ancestor && ancestor.localName !== 'tr') ancestor = ancestor.parentElement;
      ancestor?.parentNode?.removeChild(ancestor);
    }
    const markers = new Set(Array.from(document.getElementsByTagNameNS(XML_NS, 'bookmarkStart'),
      (item) => item.getAttributeNS(XML_NS, 'name') ?? item.getAttribute('w:name') ?? ''));
    const newRows = after.resume[group].filter((row) => !markers.has(officeAnchor(`${group}.${row.id}.text`)));
    for (const entry of newRows) {
      const table = Array.from(document.getElementsByTagNameNS(XML_NS, 'tbl')).find((candidate) => {
        const heading = direct(candidate, 'tr').slice(0, 2).flatMap((row) => direct(row, 'tc').map(wordCellText)).join(' ');
        return heading.includes(group === 'histories' ? '学歴・職歴' : '免許・資格');
      });
      if (!table) continue;
      const rows = direct(table, 'tr');
      let target = rows.find((row) => {
        const cells = direct(row, 'tc');
        return cells.length === 3 && cells.every((cell) => !wordCellText(cell));
      });
      if (!target) {
        const template = [...rows].reverse().find((row) => direct(row, 'tc').length === 3);
        if (!template) continue;
        target = template.cloneNode(true) as Element;
        for (const marker of Array.from(target.getElementsByTagNameNS(XML_NS, 'bookmarkStart'))) marker.parentNode?.removeChild(marker);
        for (const marker of Array.from(target.getElementsByTagNameNS(XML_NS, 'bookmarkEnd'))) marker.parentNode?.removeChild(marker);
        table.appendChild(target);
      }
      for (const [index, value] of [entry.year, entry.month, entry.text].entries()) {
        const first = direct(target, 'tc')[index].getElementsByTagNameNS(XML_NS, 't')[0];
        if (first) first.textContent = value || ' ';
      }
      markWordRow(document, target, group, entry.id);
    }
  }
}

export async function updateOfficeSource(source: OfficeSource, state: AppState, includeAccommodation: boolean, includePrivateData: boolean): Promise<Blob> {
  const original = officeSourceAsBlob(source);
  const zip = await readZip(original);
  if (state.resume.photo) {
    const media = Object.values(zip.files).find((entry) => !entry.dir &&
      entry.name.startsWith(source.format === 'docx' ? 'word/media/' : 'xl/media/'));
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(state.resume.photo.dataUrl);
    if (!media || !match) throw new Error('元のOfficeファイルの写真を更新できませんでした。');
    zip.file(media.name, base64ToBytes(match[1]));
  }
  const working = new Blob([Uint8Array.from(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })).buffer], { type: original.type });
  const manifest = createManifest(source.format, state, includeAccommodation, includePrivateData);
  if (source.format === 'docx') {
    const documentPart = zip.file('word/document.xml');
    if (!documentPart) throw new Error('Word本文が見つかりません。');
    const document = parseXml(await documentPart.async('string'));
    const previous = await readManifest(zip, source.format, new File([original], 'source.docx'));
    const oldState = parseProjectFileDocument(JSON.stringify(previous.project), true).state;
    syncWordRows(document, oldState, state);
    for (const [key, value] of Object.entries(manifest.values)) updateWordValue(document, officeAnchor(key), value);
    zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
    zip.file(PART, `<rirekishoStudio version="1">${utf8Base64(JSON.stringify(manifest))}</rirekishoStudio>`);
    return new Blob([Uint8Array.from(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })).buffer], { type: original.type });
  }
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await working.arrayBuffer() as Parameters<typeof workbook.xlsx.load>[0]);
  const previous = await readManifest(zip, source.format, new File([working], 'source.xlsx'));
  const oldState = parseProjectFileDocument(JSON.stringify(previous.project), true).state;
  syncExcelRows(workbook, oldState, state);
  for (const [key, value] of Object.entries(manifest.values)) {
    const ranges = workbook.definedNames.getRanges(officeAnchor(key)).ranges;
    if (ranges.length !== 1) continue;
    const match = /^'?(.+?)'?!\$?([A-Z]+)\$?(\d+)$/.exec(ranges[0]);
    if (!match) continue;
    const cell = workbook.getWorksheet(match[1])?.getCell(`${match[2]}${match[3]}`);
    if (cell) cell.value = value;
  }
  const sheet = workbook.getWorksheet(EXCEL_SHEET);
  if (!sheet) throw new Error('Excelの復元情報が見つかりません。');
  sheet.spliceRows(1, sheet.rowCount);
  const encoded = utf8Base64(JSON.stringify(manifest));
  for (let offset = 0, row = 1; offset < encoded.length; offset += 30_000, row += 1) {
    sheet.getCell(row, 1).value = encoded.slice(offset, offset + 30_000);
  }
  return new Blob([await workbook.xlsx.writeBuffer() as ArrayBuffer], { type: original.type });
}
