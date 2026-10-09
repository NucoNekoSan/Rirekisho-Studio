import { getAccommodationPrintFields } from './accommodation';
import { getTextAlignment } from './alignment';
import { calculateAgeFromDateInput, formatDateInputValue } from './dateFormat';
import { formatPhoneNumberForDisplay, formatPostalCodeForDisplay } from './inputFormat';
import type { AccommodationData, ResumeData, TextAlignment } from './types';

export interface OfficeField {
  label: string;
  value: string;
  alignment: TextAlignment;
}

export interface OfficeSection {
  title: string;
  fields: OfficeField[];
}

export interface OfficeExportData {
  sections: OfficeSection[];
  accommodationSections: OfficeSection[];
  photoDataUrl: string | null;
}

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
  const address = (postalCode: string, value: string) =>
    [postalCode ? `〒${formatPostalCodeForDisplay(postalCode)}` : '', value].filter(Boolean).join(' ');
  const profile: OfficeField[] = [
    field('ふりがな', basic.furigana, 'basic.furigana'),
    field('氏名', basic.name, 'basic.name'),
    field('生年月日', formatDateInputValue(basic.birthDate, resume.eraMode), 'basic.birthDate'),
    field('年齢', calculateAgeFromDateInput(basic.birthDate, asOfDate), 'basic.age'),
  ];
  if (basic.gender !== 'hidden') {
    const gender = { female: '女性', male: '男性', no_answer: '回答しない', '': '' }[basic.gender];
    profile.push(field('性別', gender, 'basic.gender'));
  }
  profile.push(
    field('現住所', address(basic.postalCode, basic.address), 'basic.address'),
    field('電話', formatPhoneNumberForDisplay(basic.phone), 'basic.phone'),
    field('Email', basic.email, 'basic.email'),
    field('連絡先', address(basic.contactPostalCode, basic.contactAddress), 'basic.contactAddress'),
    field('連絡先電話', formatPhoneNumberForDisplay(basic.contactPhone), 'basic.contactPhone'),
  );
  const entries = (rows: ResumeData['histories'], prefix: string): OfficeField[] => rows.map((row) =>
    field('年月', [row.year && `${row.year}年`, row.month && `${row.month}月`].filter(Boolean).join(' ') + (row.text ? `  ${row.text}` : ''), `${prefix}.${row.id}.text`),
  );
  const sections: OfficeSection[] = [
    { title: '基本情報', fields: profile },
    { title: '学歴・職歴', fields: entries(resume.histories, 'histories') },
    { title: '免許・資格', fields: entries(resume.qualifications, 'qualifications') },
    { title: 'その他', fields: [
      field('通勤時間', resume.commuteTime, 'resume.commuteTime'),
      field('扶養家族', resume.dependents, 'resume.dependents'),
      field('配偶者', resume.spouse, 'resume.spouse'),
      field('配偶者の扶養義務', resume.spouseSupport, 'resume.spouseSupport'),
    ] },
    { title: '志望動機・自己PR・希望', fields: [
      field('志望動機', resume.motivation, 'resume.motivation'),
      field('自己PR', resume.selfPr, 'resume.selfPr'),
      field('本人希望欄', resume.requests, 'resume.requests'),
    ] },
  ];
  const accommodationSections: OfficeSection[] = includeAccommodation && resume.enabledSupplements.includes('accommodation')
    ? [{ title: '配慮事項シート', fields: getAccommodationPrintFields(accommodation).map(({ label, value, fieldKey }) => ({
      label,
      value,
      alignment: getTextAlignment(accommodation.textAlignments, fieldKey),
    })) }]
    : [];
  return { sections, accommodationSections, photoDataUrl: resume.photo?.dataUrl ?? null };
}
