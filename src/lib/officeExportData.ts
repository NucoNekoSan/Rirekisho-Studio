import { getTextAlignment } from './alignment';
import { calculateAgeFromDateInput, formatDate, formatDateInputValue } from './dateFormat';
import { formatPhoneNumberForDisplay, formatPostalCodeForDisplay } from './inputFormat';
import { buildAccommodationPrintPages } from './printPagination';
import { HISTORY_LAYOUT, splitResumeHistory } from './resumeFixedLayout';
import type { AccommodationData, DatedEntry, PdfPaperFormat, ResumeData, TextAlignment } from './types';

export interface OfficeField {
  label: string;
  value: string;
  alignment: TextAlignment;
}

export interface OfficeDatedRow {
  year: OfficeField;
  month: OfficeField;
  text: OfficeField;
}

export interface OfficeResumePage {
  kind: 'a4-first' | 'a4-second' | 'a3' | 'continuation';
  historyLeft: OfficeDatedRow[];
  historyRight: OfficeDatedRow[];
  includeDetails: boolean;
}

export interface OfficeExportData {
  paperFormat: PdfPaperFormat;
  printDate: string;
  profile: OfficeField[];
  contact: OfficeField[];
  photoDataUrl: string | null;
  pages: OfficeResumePage[];
  qualifications: OfficeDatedRow[];
  appeals: OfficeField[];
  mini: OfficeField[];
  accommodationPages: ReturnType<typeof buildAccommodationPrintPages> | null;
}

const address = (postalCode: string, value: string) =>
  [postalCode ? `〒${formatPostalCodeForDisplay(postalCode)}` : '', value].filter(Boolean).join(' ');

export function buildOfficeExportData(
  resume: ResumeData,
  accommodation: AccommodationData,
  includeAccommodation: boolean,
  asOfDate = new Date(),
): OfficeExportData {
  const basic = resume.basic;
  const field = (label: string, value: string, key: string): OfficeField => ({
    label,
    value,
    alignment: getTextAlignment(resume.textAlignments, key),
  });
  const datedRows = (rows: DatedEntry[], kind: 'histories' | 'qualifications'): OfficeDatedRow[] => rows.map((row) => ({
    year: field('年', row.year, `${kind}.${row.id}.year`),
    month: field('月', row.month, `${kind}.${row.id}.month`),
    text: field('内容', row.text, `${kind}.${row.id}.text`),
  }));
  const profile = [
    field('ふりがな', basic.furigana, 'basic.furigana'),
    field('氏名', basic.name, 'basic.name'),
    field('生年月日', formatDateInputValue(basic.birthDate, resume.eraMode), 'basic.birthDate'),
    field('年齢', calculateAgeFromDateInput(basic.birthDate, asOfDate), 'basic.age'),
  ];
  if (basic.gender !== 'hidden') {
    const gender = { female: '女性', male: '男性', no_answer: '回答しない', '': '' }[basic.gender];
    profile.push(field('性別', gender, 'basic.gender'));
  }
  const contact = [
    field('現住所', address(basic.postalCode, basic.address), 'basic.address'),
    field('電話', formatPhoneNumberForDisplay(basic.phone), 'basic.phone'),
    field('Email', basic.email, 'basic.email'),
    field('連絡先', address(basic.contactPostalCode, basic.contactAddress), 'basic.contactAddress'),
    field('連絡先電話', formatPhoneNumberForDisplay(basic.contactPhone), 'basic.contactPhone'),
  ];
  const variant = resume.pdfPaperFormat === 'a3-landscape' ? 'a3' : 'a4';
  const { primaryRows, secondaryRows } = splitResumeHistory(resume.histories, variant);
  const primary = datedRows(primaryRows, 'histories');
  const secondary = datedRows(secondaryRows, 'histories');
  const secondaryCapacity = HISTORY_LAYOUT[variant].secondaryMin;
  const pages: OfficeResumePage[] = variant === 'a3'
    ? [{ kind: 'a3', historyLeft: primary, historyRight: secondary.slice(0, secondaryCapacity), includeDetails: true }]
    : [
      { kind: 'a4-first', historyLeft: primary, historyRight: [], includeDetails: false },
      { kind: 'a4-second', historyLeft: secondary.slice(0, secondaryCapacity), historyRight: [], includeDetails: true },
    ];
  for (let offset = secondaryCapacity; offset < secondary.length; offset += HISTORY_LAYOUT[variant].primaryRows) {
    pages.push({ kind: 'continuation', historyLeft: secondary.slice(offset, offset + HISTORY_LAYOUT[variant].primaryRows), historyRight: [], includeDetails: false });
  }
  const accommodationPages = includeAccommodation && resume.enabledSupplements.includes('accommodation')
    ? buildAccommodationPrintPages(accommodation)
    : null;
  return {
    paperFormat: resume.pdfPaperFormat,
    printDate: formatDate(asOfDate, resume.eraMode),
    profile,
    contact,
    photoDataUrl: resume.photo?.dataUrl ?? null,
    pages,
    qualifications: datedRows(resume.qualifications, 'qualifications'),
    appeals: [
      field('志望動機', resume.motivation, 'resume.motivation'),
      field('自己PR', resume.selfPr, 'resume.selfPr'),
      field('本人希望欄', resume.requests, 'resume.requests'),
    ],
    mini: [
      field('通勤', resume.commuteTime, 'resume.commuteTime'),
      field('扶養', resume.dependents, 'resume.dependents'),
      field('配偶者', resume.spouse, 'resume.spouse'),
      field('扶養家族', resume.spouseSupport, 'resume.spouseSupport'),
    ],
    accommodationPages,
  };
}
