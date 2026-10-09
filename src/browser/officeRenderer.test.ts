import { describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../lib/defaults';
import { downloadOfficeDocument } from './officeRenderer';
import { downloadBlob } from './downloadFile';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

vi.mock('./downloadFile', () => ({ downloadBlob: vi.fn() }));

describe('downloadOfficeDocument', () => {
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
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await blob.arrayBuffer() as ExcelJS.Buffer);
      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['履歴書 1', '履歴書 2', '配慮事項 1']);
      expect(workbook.getWorksheet('履歴書 1')!.getCell('C4').value).toBe('出力テスト');
    }
  });
});
