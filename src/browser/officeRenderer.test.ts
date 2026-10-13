import { describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../lib/defaults';
import { downloadOfficeDocument } from './officeRenderer';
import { downloadBlob } from './downloadFile';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { importOfficeFile } from './officePackage';
import { officeAnchor } from '../lib/officeAnchor';

vi.mock('./downloadFile', () => ({ downloadBlob: vi.fn() }));

describe('downloadOfficeDocument', () => {
  it.each(['docx', 'xlsx'] as const)('reads edited %s fields back into the form state', async (format) => {
    const state = createDefaultState();
    state.resume.basic.name = '出力時の名前';
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state);
    const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
    let edited: Blob;
    if (format === 'docx') {
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(await zip.file('word/_rels/document.xml.rels')!.async('string')).toContain('rirekishoStudio.xml');
      expect(await zip.file('[Content_Types].xml')!.async('string')).toContain('application/xml');
      const bookmark = new RegExp(`(<w:bookmarkStart[^>]*w:name="${officeAnchor('basic.name')}"[^>]*/>)([\\s\\S]*?)(<w:bookmarkEnd)`);
      expect(xml).toMatch(bookmark);
      zip.file('word/document.xml', xml.replace(bookmark, (_full, start: string, middle: string, end: string) =>
        `${start}${middle.replace('出力時の名前', '編集後の名前').replace('<w:rPr>', '<w:rPr><w:color w:val="FF0000"/>')}${end}`));
      edited = new Blob([Uint8Array.from(await zip.generateAsync({ type: 'uint8array' })).buffer]);
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await blob.arrayBuffer() as ExcelJS.Buffer);
      workbook.getWorksheet('履歴書 1')!.getCell('C4').value = '編集後の名前';
      workbook.getWorksheet('履歴書 1')!.getCell('C4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      workbook.getWorksheet('履歴書 1')!.getColumn(3).width = 22;
      edited = new Blob([await workbook.xlsx.writeBuffer() as ArrayBuffer]);
    }
    const file = new File([edited], `rirekisho.${format}`);
    const imported = await importOfficeFile(file);
    expect(imported.state.resume.basic.name).toBe('編集後の名前');
    expect(imported.officeSource.format).toBe(format);
    imported.state.resume.basic.name = '再書き出し後';
    await downloadOfficeDocument(format, imported.state.resume, imported.state.accommodation, false, '', imported.state, false, imported.officeSource);
    const [roundTrip] = vi.mocked(downloadBlob).mock.lastCall!;
    if (format === 'docx') {
      const zip = await JSZip.loadAsync(await roundTrip.arrayBuffer());
      expect(await zip.file('word/document.xml')!.async('string')).toContain('w:color w:val="FF0000"');
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await roundTrip.arrayBuffer() as ExcelJS.Buffer);
      expect(workbook.getWorksheet('履歴書 1')!.getCell('C4').fill).toMatchObject({ fgColor: { argb: 'FFFF0000' } });
      expect(workbook.getWorksheet('履歴書 1')!.getColumn(3).width).toBe(22);
    }
    const reloaded = await importOfficeFile(new File([roundTrip], `roundtrip.${format}`));
    expect(reloaded.state.resume.basic.name).toBe('再書き出し後');
  });

  it.each(['docx', 'xlsx'] as const)('imports a new %s history row', async (format) => {
    const state = createDefaultState();
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state);
    const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
    let edited: Blob;
    if (format === 'docx') {
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const document = new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'), 'application/xml');
      const tables = Array.from(document.getElementsByTagName('w:tbl'));
      const table = tables.find((item) => Array.from(item.children).some((child) =>
        child.localName === 'tr' && child.textContent?.includes('学歴・職歴')))!;
      const row = Array.from(table.children).filter((child) => child.localName === 'tr')[7];
      const cells = Array.from(row.children).filter((child) => child.localName === 'tc');
      ['2030', '4', '追加した学歴'].forEach((value, index) => {
        cells[index].getElementsByTagName('w:t')[0].textContent = value;
      });
      zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
      edited = new Blob([Uint8Array.from(await zip.generateAsync({ type: 'uint8array' })).buffer]);
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await blob.arrayBuffer() as ExcelJS.Buffer);
      const sheet = workbook.getWorksheet('履歴書 1')!;
      sheet.getCell('A19').value = '2030';
      sheet.getCell('B19').value = '4';
      sheet.getCell('C19').value = '追加した学歴';
      edited = new Blob([await workbook.xlsx.writeBuffer() as ArrayBuffer]);
    }
    const imported = await importOfficeFile(new File([edited], `edited.${format}`));
    expect(imported.state.resume.histories.map((row) => row.text)).toContain('追加した学歴');
    const added = imported.state.resume.histories.find((row) => row.text === '追加した学歴')!;
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Uint8Array.from(atob(imported.officeSource.base64), (char) => char.charCodeAt(0)).buffer as ExcelJS.Buffer);
      expect(workbook.definedNames.getRanges(officeAnchor(`histories.${added.id}.text`)).ranges).toHaveLength(1);
      expect(workbook.definedNames.getRanges(officeAnchor(`histories.${added.id}.text`)).ranges[0]).toBe("'履歴書 1'!$C$19");
    }
    added.text = '再編集した学歴';
    await downloadOfficeDocument(format, imported.state.resume, imported.state.accommodation, false, '', imported.state, false, imported.officeSource);
    const [roundTrip] = vi.mocked(downloadBlob).mock.lastCall!;
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await roundTrip.arrayBuffer() as ExcelJS.Buffer);
      expect(workbook.getWorksheet('履歴書 1')!.getCell('C19').value).toBe('再編集した学歴');
    }
    const reloaded = await importOfficeFile(new File([roundTrip], `roundtrip.${format}`));
    expect(reloaded.state.resume.histories.map((row) => row.text)).toContain('再編集した学歴');
  });

  it.each(['docx', 'xlsx'] as const)('keeps A3 history and qualification rows in %s', async (format) => {
    const state = createDefaultState();
    state.resume.pdfPaperFormat = 'a3-landscape';
    state.resume.qualifications[0].text = '普通自動車第一種運転免許';
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state);
    const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
    const imported = await importOfficeFile(new File([blob], `rirekisho.${format}`));
    expect(imported.state.resume.histories.map((row) => row.text)).toEqual(state.resume.histories.map((row) => row.text));
    expect(imported.state.resume.qualifications.map((row) => row.text)).toEqual(['普通自動車第一種運転免許']);
  });

  it.each(['docx', 'xlsx'] as const)('restores continued A3 history order from %s', async (format) => {
    const state = createDefaultState();
    state.resume.pdfPaperFormat = 'a3-landscape';
    state.resume.histories = Array.from({ length: 30 }, (_, index) => ({
      id: crypto.randomUUID(), year: String(2000 + index), month: '4', text: `経歴${index + 1}`,
    }));
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state);
    const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
    const imported = await importOfficeFile(new File([blob], `rirekisho.${format}`));
    expect(imported.state.resume.histories.map((row) => row.text)).toEqual(state.resume.histories.map((row) => row.text));
  });

  it.each(['docx', 'xlsx'] as const)('keeps an app-added history row in %s', async (format) => {
    const state = createDefaultState();
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state);
    const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
    const imported = await importOfficeFile(new File([blob], `resume.${format}`));
    imported.state.resume.histories.push({ id: crypto.randomUUID(), year: '2032', month: '3', text: 'フォームで追加した行' });
    await downloadOfficeDocument(format, imported.state.resume, imported.state.accommodation, false, '', imported.state, false, imported.officeSource);
    const [roundTrip] = vi.mocked(downloadBlob).mock.lastCall!;
    const reloaded = await importOfficeFile(new File([roundTrip], `roundtrip.${format}`));
    expect(reloaded.state.resume.histories.map((row) => row.text)).toContain('フォームで追加した行');
  });

  it.each(['docx', 'xlsx'] as const)('removes a deleted history row from %s', async (format) => {
    const state = createDefaultState();
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state);
    const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
    const imported = await importOfficeFile(new File([blob], `resume.${format}`));
    imported.state.resume.histories = imported.state.resume.histories.filter((row) => row.text !== '高等学校 卒業');
    await downloadOfficeDocument(format, imported.state.resume, imported.state.accommodation, false, '', imported.state, false, imported.officeSource);
    const [roundTrip] = vi.mocked(downloadBlob).mock.lastCall!;
    const reloaded = await importOfficeFile(new File([roundTrip], `roundtrip.${format}`));
    expect(reloaded.state.resume.histories.map((row) => row.text)).not.toContain('高等学校 卒業');
  });

  it.each(['docx', 'xlsx'] as const)('includes private draft fields in %s only when selected', async (format) => {
    const state = createDefaultState();
    state.resume.memo = '非公開メモ';
    state.accommodation.strengths = '非公開配慮';
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state, false);
    const [ordinary] = vi.mocked(downloadBlob).mock.lastCall!;
    const ordinaryImport = await importOfficeFile(new File([ordinary], `ordinary.${format}`));
    expect(ordinaryImport.state.resume.memo).toBe('');
    expect(ordinaryImport.state.accommodation.strengths).toBe('');
    expect(state.resume.memo).toBe('非公開メモ');
    await downloadOfficeDocument(format, state.resume, state.accommodation, false, '', state, true);
    const [privateFile] = vi.mocked(downloadBlob).mock.lastCall!;
    const privateImport = await importOfficeFile(new File([privateFile], `private.${format}`));
    expect(privateImport.state.resume.memo).toBe('非公開メモ');
    expect(privateImport.state.accommodation.strengths).toBe('非公開配慮');
  });
  it.each(['docx', 'xlsx'] as const)('creates an editable %s package locally', async (format) => {
    const { resume, accommodation } = createDefaultState();
    resume.basic.name = '出力テスト';
    resume.enabledSupplements = ['accommodation'];
    accommodation.strengths = '共有する内容';
    await downloadOfficeDocument(format, resume, accommodation, true);
    const [blob, name] = vi.mocked(downloadBlob).mock.lastCall!;
    expect(name).toBe(`rirekisho-and-accommodation.${format}`);
    expect(blob.size).toBeGreaterThan(1000);
    expect(Array.from(new Uint8Array(await blob.slice(0, 2).arrayBuffer()))).toEqual([80, 75]);
    if (format === 'docx') {
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('出力テスト');
      expect(xml).toContain('共有する内容');
      expect(xml).toContain('志望動機');
      expect(xml).toContain('免許・資格');
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await blob.arrayBuffer() as ExcelJS.Buffer);
      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['履歴書 1', '履歴書 2', '配慮事項 1']);
      expect(workbook.getWorksheet('履歴書 1')!.getCell('C4').value).toBe('出力テスト');
      expect(workbook.getWorksheet('履歴書 1')!.getCell('I3').isMerged).toBe(true);
      expect(workbook.getWorksheet('履歴書 1')!.pageSetup.printArea).toMatch(/^A1:J\d+$/);
      expect(workbook.getWorksheet('履歴書 2')!.getCell('A20').value).toBe('志望動機');
    }
  });

  it('keeps the A3 history rows compact beside editable long text', async () => {
    const { resume, accommodation } = createDefaultState();
    resume.pdfPaperFormat = 'a3-landscape';
    resume.motivation = '志望理由'.repeat(90);
    await downloadOfficeDocument('xlsx', resume, accommodation, false);
    const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer() as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet('履歴書')!;
    expect(sheet.pageSetup.orientation).toBe('landscape');
    expect(sheet.getCell('J23').isMerged).toBe(true);
    expect(sheet.getRow(23).height).toBeLessThan(30);
    expect(sheet.getCell('C14').value).toBe('学歴');
    expect(sheet.getCell('C15').value).toBe('高等学校 入学');
  });

  it('marks a practice download as a demo file', async () => {
    const { resume, accommodation } = createDefaultState();
    await downloadOfficeDocument('docx', resume, accommodation, false, 'demo-');
    expect(vi.mocked(downloadBlob).mock.lastCall?.[1]).toBe('demo-rirekisho.docx');
  });
});
