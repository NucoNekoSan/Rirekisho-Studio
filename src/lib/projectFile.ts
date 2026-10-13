// JSON保存・読込のバリデーション: プロジェクトファイルの入出力と型検証
import {
  APP_NAME,
  PHOTO_ACCEPTED_EXTENSIONS,
  PHOTO_ACCEPTED_MIME_TYPES,
  PHOTO_MAX_FILE_SIZE_BYTES,
  PHOTO_MAX_FILE_SIZE_MB,
  PROJECT_SCHEMA_VERSION,
} from './config';
import { createDefaultAccommodation } from './defaults';
import { isRecord } from './validation';
import type {
  AccommodationData,
  AppState,
  BasicInfo,
  GenderOption,
  HistoryEntry,
  PhotoData,
  PdfFontFamily,
  PdfPaperFormat,
  ProjectFile,
  OfficeSource,
  QualificationEntry,
  ResumeData,
  TextAlignment,
  TextAlignmentMap,
} from './types';

// バリデーション上限値: 不正な入力データの読み込みを防ぐ
const SAVE_FILE_MAX_CHARS = Math.ceil(PHOTO_MAX_FILE_SIZE_BYTES * 1.5) + 1_000_000;
const PHOTO_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
const PHOTO_DATA_URL_MAX_CHARS = Math.ceil(PHOTO_MAX_FILE_SIZE_BYTES / 3) * 4 + PHOTO_DATA_URL_PREFIX.length;
const MAX_ROWS = 80;
const SHORT_TEXT_MAX = 300;
const MEDIUM_TEXT_MAX = 1_000;
const LONG_TEXT_MAX = 6_000;
const MAX_ALIGNMENT_ENTRIES = 500;
const MAX_ALIGNMENT_KEY_LENGTH = 160;
const MAX_PHOTO_DIMENSION_PX = 6_000;

const invalidSaveFile = () => new Error('入力データファイルの内容が不正です。');

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw invalidSaveFile();
  return value;
};

const asString = (value: unknown, maxLength = SHORT_TEXT_MAX): string => {
  if (typeof value !== 'string' || value.length > maxLength) throw invalidSaveFile();
  return value;
};

const asOptionalString = (value: unknown, maxLength = SHORT_TEXT_MAX): string => {
  if (value === undefined) return '';
  return asString(value, maxLength);
};

const asBoolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') throw invalidSaveFile();
  return value;
};

const asOptionalBoolean = (value: unknown): boolean => {
  if (value === undefined) return false;
  return asBoolean(value);
};

const asNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalidSaveFile();
  return value;
};

const asEnum = <T extends string>(value: unknown, allowed: readonly T[]): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw invalidSaveFile();
  return value as T;
};

const validateTextAlignments = (value: unknown): TextAlignmentMap => {
  if (value === undefined) return {};
  const record = asRecord(value);
  const entries = Object.entries(record);
  if (entries.length > MAX_ALIGNMENT_ENTRIES) throw invalidSaveFile();

  return entries.reduce<TextAlignmentMap>((alignments, [key, alignment]) => {
    if (key.length > MAX_ALIGNMENT_KEY_LENGTH) throw invalidSaveFile();
    alignments[key] = asEnum<TextAlignment>(alignment, ['left', 'center', 'right']);
    return alignments;
  }, {});
};

const validatePdfFontFamily = (value: unknown): PdfFontFamily => {
  if (value === 'gothic') return 'gothic';
  return 'mincho';
};

const validatePdfPaperFormat = (value: unknown): PdfPaperFormat => {
  if (value === 'a3-landscape') return 'a3-landscape';
  return 'a4-portrait';
};

const validateRows = <T extends HistoryEntry | QualificationEntry>(value: unknown): T[] => {
  if (!Array.isArray(value) || value.length > MAX_ROWS) throw invalidSaveFile();
  return value.map((item) => {
    const row = asRecord(item);
    return {
      id: asString(row.id, 80),
      year: asString(row.year, 20),
      month: asString(row.month, 20),
      text: asString(row.text, MEDIUM_TEXT_MAX),
    } as T;
  });
};

const validatePhoto = (value: unknown): PhotoData | null => {
  if (value === null) return null;
  const photo = asRecord(value);
  const dataUrl = asString(photo.dataUrl, PHOTO_DATA_URL_MAX_CHARS);
  const fileName = asString(photo.fileName, 255);
  const mimeType = asEnum(photo.mimeType, PHOTO_ACCEPTED_MIME_TYPES);
  const size = asNumber(photo.size);
  const width = asNumber(photo.width);
  const height = asNumber(photo.height);

  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) throw invalidSaveFile();
  const encodedData = dataUrl.slice(PHOTO_DATA_URL_PREFIX.length);
  if (encodedData.length % 4 !== 0) throw invalidSaveFile();
  const paddingLength = encodedData.endsWith('==') ? 2 : encodedData.endsWith('=') ? 1 : 0;
  const decodedSize = (encodedData.length / 4) * 3 - paddingLength;
  if (!Number.isInteger(size) || size < 0 || size > PHOTO_MAX_FILE_SIZE_BYTES || decodedSize > PHOTO_MAX_FILE_SIZE_BYTES) {
    throw new Error(`入力データファイル内の写真は${PHOTO_MAX_FILE_SIZE_MB}MB以下のJPG/JPEGのみ読み込めます。`);
  }
  if (!PHOTO_ACCEPTED_EXTENSIONS.some((extension) => fileName.toLowerCase().endsWith(extension))) throw invalidSaveFile();
  let signature: string;
  try {
    signature = atob(encodedData.slice(0, 8));
  } catch {
    throw invalidSaveFile();
  }
  if (signature.charCodeAt(0) !== 0xff || signature.charCodeAt(1) !== 0xd8 || signature.charCodeAt(2) !== 0xff) {
    throw invalidSaveFile();
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > MAX_PHOTO_DIMENSION_PX || height > MAX_PHOTO_DIMENSION_PX) {
    throw invalidSaveFile();
  }

  return {
    dataUrl,
    fileName,
    mimeType,
    size,
    width,
    height,
    updatedAt: asString(photo.updatedAt, 40),
  };
};

const validateBasic = (value: unknown): BasicInfo => {
  const basic = asRecord(value);
  return {
    name: asString(basic.name),
    furigana: asString(basic.furigana),
    birthDate: asString(basic.birthDate, 20),
    age: asOptionalString(basic.age, 20),
    gender: asEnum<GenderOption>(basic.gender, ['', 'female', 'male', 'no_answer', 'hidden']),
    postalCode: asString(basic.postalCode, 20),
    address: asString(basic.address, MEDIUM_TEXT_MAX),
    phone: asString(basic.phone, 40),
    email: asString(basic.email, 254),
    contactPostalCode: asString(basic.contactPostalCode, 20),
    contactAddress: asString(basic.contactAddress, MEDIUM_TEXT_MAX),
    contactPhone: asString(basic.contactPhone, 40),
  };
};

const validateResume = (value: unknown, includePhoto: boolean): ResumeData => {
  const resume = asRecord(value);
  const legacyApplicationType = resume.applicationType === 'disability' ? 'disability' : 'general';
  const enabledSupplements = resume.enabledSupplements === undefined
    ? (legacyApplicationType === 'disability' ? ['accommodation'] : [])
    : (Array.isArray(resume.enabledSupplements)
        && resume.enabledSupplements.every((item) => item === 'accommodation')
      ? [...new Set(resume.enabledSupplements)]
      : (() => { throw invalidSaveFile(); })());
  return {
    enabledSupplements,
    inputMode: 'standard',
    eraMode: asEnum(resume.eraMode, ['western', 'japanese']),
    pdfFontFamily: validatePdfFontFamily(resume.pdfFontFamily),
    pdfPaperFormat: validatePdfPaperFormat(resume.pdfPaperFormat),
    createdAt: asString(resume.createdAt, 40),
    updatedAt: asString(resume.updatedAt, 40),
    basic: validateBasic(resume.basic),
    histories: validateRows<HistoryEntry>(resume.histories),
    qualifications: validateRows<QualificationEntry>(resume.qualifications),
    commuteTime: asString(resume.commuteTime),
    dependents: asString(resume.dependents),
    spouse: asString(resume.spouse),
    spouseSupport: asString(resume.spouseSupport),
    motivation: asString(resume.motivation, LONG_TEXT_MAX),
    selfPr: asString(resume.selfPr, LONG_TEXT_MAX),
    requests: asString(resume.requests, LONG_TEXT_MAX),
    memo: asString(resume.memo, LONG_TEXT_MAX),
    photo: includePhoto ? validatePhoto(resume.photo) : null,
    textAlignments: validateTextAlignments(resume.textAlignments),
  };
};

const validateAccommodation = (value: unknown): AccommodationData => {
  const accommodation = asRecord(value);
  return {
    includeDisabilityName: asBoolean(accommodation.includeDisabilityName),
    disabilityName: asString(accommodation.disabilityName, LONG_TEXT_MAX),
    includeCertificate: asBoolean(accommodation.includeCertificate),
    certificate: asString(accommodation.certificate, LONG_TEXT_MAX),
    includeHospitalVisit: asBoolean(accommodation.includeHospitalVisit),
    hospitalVisit: asString(accommodation.hospitalVisit, LONG_TEXT_MAX),
    includeMedication: asBoolean(accommodation.includeMedication),
    medication: asString(accommodation.medication, LONG_TEXT_MAX),
    includeSupportContact: asBoolean(accommodation.includeSupportContact),
    supportContact: asString(accommodation.supportContact, LONG_TEXT_MAX),
    strengths: asString(accommodation.strengths, LONG_TEXT_MAX),
    difficultSituations: asString(accommodation.difficultSituations, LONG_TEXT_MAX),
    requestedAccommodations: asString(accommodation.requestedAccommodations, LONG_TEXT_MAX),
    selfCare: asString(accommodation.selfCare, LONG_TEXT_MAX),
    warningSigns: asString(accommodation.warningSigns, LONG_TEXT_MAX),
    textAlignments: validateTextAlignments(accommodation.textAlignments),
  };
};

const validateAppState = (value: unknown, includePhoto: boolean, includeAccommodation: boolean, preserveDisabledAccommodation = false): AppState => {
  const state = asRecord(value);
  const resume = validateResume(state.resume, includePhoto);
  return {
    resume,
    accommodation: includeAccommodation && (preserveDisabledAccommodation || resume.enabledSupplements.includes('accommodation'))
      ? validateAccommodation(state.accommodation)
      : createDefaultAccommodation(),
  };
};

export const buildProjectFile = (
  state: AppState,
  includePhoto: boolean,
  documentId: string = crypto.randomUUID(),
  documentName = '名称未設定の履歴書',
): ProjectFile => {
  const includeAccommodation = state.resume.enabledSupplements.includes('accommodation');
  const projectState: AppState = includePhoto
    ? state
    : {
        ...state,
        resume: {
          ...state.resume,
          photo: null,
        },
      };

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: APP_NAME,
    documentId,
    documentName,
    includePhoto,
    includeAccommodation,
    state: includeAccommodation
      ? projectState
      : {
          ...projectState,
          accommodation: createDefaultAccommodation(),
        },
  };
};

export const serializeProjectFile = (
  state: AppState,
  includePhoto: boolean,
  documentId?: string,
  documentName?: string,
  officeSource?: OfficeSource,
): string => JSON.stringify({ ...buildProjectFile(state, includePhoto, documentId, documentName), ...(officeSource ? { officeSource } : {}) }, null, 2);

export interface ParsedProjectFile {
  documentId: string;
  documentName: string;
  state: AppState;
  officeSource?: OfficeSource;
}

export const parseProjectFileDocument = (text: string, preserveDisabledAccommodation = false): ParsedProjectFile => {
  if (text.length > SAVE_FILE_MAX_CHARS + 40_000_000) {
    throw new Error('入力データファイルが大きすぎます。写真を含める場合は写真サイズ上限を確認してください。');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('入力データファイルの形式が不正です。');
  }

  const project = asRecord(parsed);
  const schemaVersion = project.schemaVersion;
  const isLegacy = schemaVersion === 1 && project.app === 'Rirekisho Builder';
  if ((!isLegacy && (schemaVersion !== PROJECT_SCHEMA_VERSION || project.app !== APP_NAME)) || typeof project.exportedAt !== 'string') {
    throw new Error('対応していない入力データファイルです。');
  }
  const includePhoto = asOptionalBoolean(project.includePhoto);
  const includeAccommodation = asOptionalBoolean(project.includeAccommodation);
  return {
    documentId: isLegacy ? crypto.randomUUID() : asString(project.documentId, 80),
    documentName: isLegacy ? '読み込んだ履歴書' : asString(project.documentName, 120),
    state: validateAppState(project.state, includePhoto, includeAccommodation, preserveDisabledAccommodation),
    officeSource: validateOfficeSource(project.officeSource),
  };
};

const validateOfficeSource = (value: unknown): OfficeSource | undefined => {
  if (value === undefined) return undefined;
  const source = asRecord(value);
  if (source.format !== 'docx' && source.format !== 'xlsx') throw invalidSaveFile();
  if (source.paperFormat !== 'a4-portrait' && source.paperFormat !== 'a3-landscape') throw invalidSaveFile();
  if (typeof source.printedAccommodation !== 'boolean') throw invalidSaveFile();
  if (typeof source.hasPhoto !== 'boolean') throw invalidSaveFile();
  if (typeof source.base64 !== 'string' || source.base64.length > 40_000_000 ||
    !/^UEs[A-Za-z0-9+/]*={0,2}$/.test(source.base64) || source.base64.length % 4 !== 0) throw invalidSaveFile();
  return { format: source.format, base64: source.base64, paperFormat: source.paperFormat,
    printedAccommodation: source.printedAccommodation, hasPhoto: source.hasPhoto };
};

export const parseProjectFile = (text: string): AppState => parseProjectFileDocument(text).state;
