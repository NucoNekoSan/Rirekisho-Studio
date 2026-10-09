import { describe, expect, it } from 'vitest';
import { createDefaultState } from './defaults';
import { buildOfficeExportData } from './officeExportData';

describe('buildOfficeExportData', () => {
  it('omits memo, hidden gender, and disabled sensitive fields', () => {
    const { resume, accommodation } = createDefaultState();
    resume.memo = '非公開メモ';
    resume.basic.gender = 'hidden';
    resume.enabledSupplements = ['accommodation'];
    accommodation.disabilityName = '非公開の診断名';
    accommodation.includeDisabilityName = false;
    accommodation.strengths = '共有する強み';
    const data = buildOfficeExportData(resume, accommodation, true);
    const allFields = [...data.profile, ...data.contact, ...data.appeals, ...data.mini];
    expect(allFields.some((field) => field.label === '性別')).toBe(false);
    expect(JSON.stringify(data)).not.toContain('非公開メモ');
    expect(JSON.stringify(data)).not.toContain('非公開の診断名');
    expect(JSON.stringify(data)).toContain('共有する強み');
    expect(buildOfficeExportData(resume, accommodation, false).accommodationPages).toBeNull();
  });

  it('keeps every history entry on continuation pages when the PDF grid is full', () => {
    const { resume, accommodation } = createDefaultState();
    resume.histories = Array.from({ length: 31 }, (_, index) => ({
      id: `history-${index}`, year: `${2000 + index}`, month: '4', text: `履歴 ${index + 1}`,
    }));
    const data = buildOfficeExportData(resume, accommodation, false);
    expect(data.pages.map((page) => page.kind)).toEqual(['a4-first', 'a4-second', 'continuation']);
    expect(data.pages.flatMap((page) => page.historyLeft).map((entry) => entry.text.value))
      .toEqual(resume.histories.map((entry) => entry.text));
    resume.pdfPaperFormat = 'a3-landscape';
    const a3 = buildOfficeExportData(resume, accommodation, false);
    expect(a3.pages.map((page) => page.kind)).toEqual(['a3', 'continuation']);
    expect(a3.pages.flatMap((page) => [...page.historyLeft, ...page.historyRight]).map((entry) => entry.text.value))
      .toEqual(resume.histories.map((entry) => entry.text));
  });
});
