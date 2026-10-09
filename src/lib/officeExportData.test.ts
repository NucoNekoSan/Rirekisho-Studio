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
});
