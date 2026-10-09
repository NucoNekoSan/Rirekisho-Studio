import { downloadBlob } from './downloadFile';
import { buildOfficeExportData } from '../lib/officeExportData';
import type { AccommodationData, ResumeData } from '../lib/types';

export type OfficeFormat = 'docx' | 'xlsx';

export async function downloadOfficeDocument(
  format: OfficeFormat,
  resume: ResumeData,
  accommodation: AccommodationData,
  includeAccommodation: boolean,
): Promise<void> {
  const data = buildOfficeExportData(resume, accommodation, includeAccommodation);
  const blob = format === 'docx'
    ? await import('./wordRenderer').then(({ createWordDocument }) => createWordDocument(data, resume, accommodation))
    : await import('./excelRenderer').then(({ createExcelDocument }) => createExcelDocument(data, resume, accommodation));
  const stem = `rirekisho${resume.pdfPaperFormat === 'a3-landscape' ? '-a3' : ''}${data.accommodationPages ? '-and-accommodation' : ''}`;
  downloadBlob(blob, `${stem}.${format}`);
}
