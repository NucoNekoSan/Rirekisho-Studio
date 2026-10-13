import { downloadBlob } from './downloadFile';
import { updateOfficeSource } from './officePackage';
import { buildOfficeExportData } from '../lib/officeExportData';
import { attachOfficeManifest } from './officePackage';
import type { AccommodationData, AppState, OfficeSource, ResumeData } from '../lib/types';

export type OfficeFormat = 'docx' | 'xlsx';

export async function downloadOfficeDocument(
  format: OfficeFormat,
  resume: ResumeData,
  accommodation: AccommodationData,
  includeAccommodation: boolean,
  fileNamePrefix = '',
  projectState?: AppState,
  includePrivateData = false,
  officeSource?: OfficeSource,
): Promise<void> {
  const data = buildOfficeExportData(resume, accommodation, includeAccommodation);
  const blob = officeSource?.format === format && officeSource.paperFormat === resume.pdfPaperFormat &&
    officeSource.printedAccommodation === includeAccommodation && officeSource.hasPhoto === Boolean(resume.photo) && projectState &&
    officeSource.base64.length > 0
    ? await updateOfficeSource(officeSource, projectState, includeAccommodation, includePrivateData)
    : await (async () => {
      const rendered = format === 'docx'
        ? await import('./wordRenderer').then(({ createWordDocument }) => createWordDocument(data, resume, accommodation))
        : await import('./excelRenderer').then(({ createExcelDocument }) => createExcelDocument(data, resume, accommodation));
      return projectState ? attachOfficeManifest(rendered, format, projectState, includeAccommodation, includePrivateData) : rendered;
    })();
  const stem = `rirekisho${resume.pdfPaperFormat === 'a3-landscape' ? '-a3' : ''}${data.accommodationPages ? '-and-accommodation' : ''}`;
  downloadBlob(blob, `${fileNamePrefix}${stem}.${format}`);
}
