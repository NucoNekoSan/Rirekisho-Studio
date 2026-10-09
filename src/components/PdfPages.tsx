// PDF出力用のページレイアウト: A4・A3履歴書と配慮事項シートの印刷用コンポーネント
import { calculateAgeFromDateInput, formatDate, formatDateInputValue } from '../lib/dateFormat';
import { formatPhoneNumberForDisplay, formatPostalCodeForDisplay } from '../lib/inputFormat';
import { getTextAlignment } from '../lib/alignment';
import { buildAccommodationPrintPages } from '../lib/printPagination';
import { splitResumeHistory, type ResumePaperVariant } from '../lib/resumeFixedLayout';
import type {
  AccommodationPrintSection,
  ResumePrintSection,
  ResumeTextSection,
  ResumeTableSection,
} from '../lib/printPagination';
import type { AccommodationData, EraMode, HistoryEntry, PdfFontFamily, ResumeData, TextAlignment, TextAlignmentMap } from '../lib/types';

const genderLabel = (value: ResumeData['basic']['gender']) => {
  switch (value) {
    case 'female':
      return '女性';
    case 'male':
      return '男性';
    case 'no_answer':
      return '回答しない';
    case 'hidden':
      return '';
    default:
      return '';
  }
};

const empty = (value: string, fallback = '') => value.trim() || fallback;
const sectionTitle = (title: string, continued: boolean) => (continued ? `${title}（続き）` : title);
const alignmentClass = (alignment: TextAlignment = 'left') => `align-${alignment}`;
const alignmentFor = (alignments: TextAlignmentMap, key: string) => alignmentClass(getTextAlignment(alignments, key));
const pdfFontClass = (pdfFontFamily: PdfFontFamily = 'gothic') => `pdf-font-${pdfFontFamily}`;
const addressLine = (postalCode: string, address: string) => {
  const formattedPostalCode = formatPostalCodeForDisplay(postalCode);
  return [formattedPostalCode ? `〒${formattedPostalCode}` : '', empty(address)].filter(Boolean).join(' ');
};

function ResumeHeader({
  resume,
  pageNumber,
  pageCount,
  printDate,
}: {
  resume: ResumeData;
  pageNumber: number;
  pageCount: number;
  printDate: Date;
}) {
  return (
    <header className="resume-title-row">
      <h2>履歴書</h2>
      <div className="resume-date">
        作成日: {formatDate(printDate, resume.eraMode)} / {pageNumber}/{pageCount}
      </div>
    </header>
  );
}

function ResumeProfile({ resume, printDate }: { resume: ResumeData; printDate: Date }) {
  const basic = resume.basic;
  const age = calculateAgeFromDateInput(basic.birthDate, printDate);
  return (
    <section className="resume-profile-section" aria-label="基本情報">
      <div className="resume-profile-grid">
        <div className="profile-main">
          <div className="field-line large"><span>ふりがな</span><strong className={alignmentFor(resume.textAlignments, 'basic.furigana')}>{empty(basic.furigana)}</strong></div>
          <div className="field-line name"><span>氏名</span><strong className={alignmentFor(resume.textAlignments, 'basic.name')}>{empty(basic.name)}</strong></div>
          {basic.gender !== 'hidden' ? (
            <div className="field-row birth-age-gender-row">
              <div className="field-line"><span>生年月日</span><strong className={alignmentFor(resume.textAlignments, 'basic.birthDate')}>{empty(formatDateInputValue(basic.birthDate, resume.eraMode))}</strong></div>
              <div className="field-line"><span>年齢</span><strong className={alignmentFor(resume.textAlignments, 'basic.age')}>{empty(age)}</strong></div>
              <div className="field-line"><span>性別</span><strong className={alignmentFor(resume.textAlignments, 'basic.gender')}>{genderLabel(basic.gender)}</strong></div>
            </div>
          ) : (
            <div className="field-row birth-age-row">
              <div className="field-line"><span>生年月日</span><strong className={alignmentFor(resume.textAlignments, 'basic.birthDate')}>{empty(formatDateInputValue(basic.birthDate, resume.eraMode))}</strong></div>
              <div className="field-line"><span>年齢</span><strong className={alignmentFor(resume.textAlignments, 'basic.age')}>{empty(age)}</strong></div>
            </div>
          )}
        </div>
        <div className="photo-box">
          {resume.photo ? <img src={resume.photo.dataUrl} alt="履歴書用写真" /> : <span>写真</span>}
        </div>
      </div>

      <section className="resume-box">
        <div className="field-line"><span>現住所</span><strong className={alignmentFor(resume.textAlignments, 'basic.address')}>{addressLine(basic.postalCode, basic.address)}</strong></div>
        <div className="field-row">
          <div className="field-line"><span>電話</span><strong className={alignmentFor(resume.textAlignments, 'basic.phone')}>{empty(formatPhoneNumberForDisplay(basic.phone))}</strong></div>
          <div className="field-line"><span>Email</span><strong className={alignmentFor(resume.textAlignments, 'basic.email')}>{empty(basic.email)}</strong></div>
        </div>
        <div className="field-line"><span>連絡先</span><strong className={alignmentFor(resume.textAlignments, 'basic.contactAddress')}>{addressLine(basic.contactPostalCode, basic.contactAddress)}</strong></div>
        <div className="field-line"><span>連絡先電話</span><strong className={alignmentFor(resume.textAlignments, 'basic.contactPhone')}>{empty(formatPhoneNumberForDisplay(basic.contactPhone))}</strong></div>
      </section>
    </section>
  );
}

function ResumeTable({
  section,
  resume,
  minRows = 0,
}: {
  section: ResumeTableSection;
  resume: ResumeData;
  minRows?: number;
}) {
  return (
    <section className={`resume-table-block ${section.kind === 'qualifications' ? 'small-table' : ''}`}>
      <h3>{sectionTitle(section.title, section.continued)}</h3>
      <table>
        <thead><tr><th>年</th><th>月</th><th>内容</th></tr></thead>
        <ResumeTableRows kind={section.kind} rows={section.rows} resume={resume} minRows={minRows} />
      </table>
    </section>
  );
}

function ResumeTableRows({
  kind,
  rows,
  resume,
  minRows = 0,
}: {
  kind: ResumeTableSection['kind'];
  rows: ResumeTableSection['rows'];
  resume: ResumeData;
  minRows?: number;
}) {
  const blankRows = Math.max(0, minRows - rows.length);
  return (
    <tbody>
      {rows.map((item) => (
        <tr key={item.id}>
          <td className={alignmentFor(resume.textAlignments, `${kind}.${item.id}.year`)}>{item.year}</td>
          <td className={alignmentFor(resume.textAlignments, `${kind}.${item.id}.month`)}>{item.month}</td>
          <td className={alignmentFor(resume.textAlignments, `${kind}.${item.id}.text`)}>{item.text}</td>
        </tr>
      ))}
      {Array.from({ length: blankRows }, (_, index) => (
        <tr key={`blank-${index}`} className="print-empty-row" aria-hidden="true">
          <td />
          <td />
          <td />
        </tr>
      ))}
    </tbody>
  );
}

/**
 * A4/A3の固定レイアウトにおける学歴・職歴テーブルの行数設定。
 * printPagination.ts の動的ページ分割とは独立した、固定ページ構造の制御値。
 *
 * - primaryRows: 1ページ目（A3は左カラム）に表示する最大行数
 * - primaryMin:  1ページ目の最小空行数（テーブルの高さを一定に保つ）
 * - secondaryMin: 2ページ目（A3は右カラム）の最小空行数
 * - qualBlanks:  免許・資格テーブルの下に追加する空行数
 */
function ResumeHistoryTable({
  variant,
  resume,
  rows,
  className,
  ariaLabel,
  minRows,
}: {
  variant: ResumePaperVariant;
  resume: ResumeData;
  rows: HistoryEntry[];
  className: string;
  ariaLabel: string;
  minRows: number;
}) {
  return (
    <section className={`resume-table-block resume-${variant}-history-block ${className}`} aria-label={ariaLabel}>
      <h3>学歴・職歴</h3>
      <table>
        <thead><tr><th>年</th><th>月</th><th>内容</th></tr></thead>
        <ResumeTableRows kind="histories" rows={rows} resume={resume} minRows={Math.max(minRows, rows.length)} />
      </table>
    </section>
  );
}

function ResumeA3ProfileBlock({ resume, printDate }: { resume: ResumeData; printDate: Date }) {
  return (
    <section className="resume-a3-profile-block">
      <header className="resume-title-row">
        <h2>履歴書</h2>
        <div className="resume-date">
          作成日: {formatDate(printDate, resume.eraMode)}
        </div>
      </header>
      <ResumeProfile resume={resume} printDate={printDate} />
    </section>
  );
}

function ResumeTextBox({
  section,
  resume,
}: {
  section: Extract<ResumePrintSection, { type: 'text' }>;
  resume: ResumeData;
}) {
  return (
    <section className={`resume-text-box resume-text-${section.kind}`}>
      <h3>{sectionTitle(section.title, section.continued)}</h3>
      <p className={alignmentFor(resume.textAlignments, `resume.${section.kind}`)}>{empty(section.value)}</p>
    </section>
  );
}

function ResumeMiniGrid({ resume }: { resume: ResumeData }) {
  return (
    <section className="mini-grid resume-mini-grid" aria-label="通勤・扶養家族">
      <p><span>通勤</span><strong className={alignmentFor(resume.textAlignments, 'resume.commuteTime')}>{empty(resume.commuteTime)}</strong></p>
      <p><span>扶養</span><strong className={alignmentFor(resume.textAlignments, 'resume.dependents')}>{empty(resume.dependents)}</strong></p>
      <p><span>配偶者</span><strong className={alignmentFor(resume.textAlignments, 'resume.spouse')}>{empty(resume.spouse)}</strong></p>
      <p><span>扶養<br />家族</span><strong className={alignmentFor(resume.textAlignments, 'resume.spouseSupport')}>{empty(resume.spouseSupport)}</strong></p>
    </section>
  );
}

/** A4縦・2ページ固定レイアウトの履歴書PDF */
export function ResumePage({
  resume,
  printDate = new Date(),
  captureRef,
}: {
  resume: ResumeData;
  printDate?: Date;
  captureRef?: (node: HTMLElement | null) => void;
}) {
  const pageData = prepareResumePageData(resume, 'a4');
  return (
    <div ref={captureRef} className={`pdf-document resume-document resume-a4-document ${pdfFontClass(resume.pdfFontFamily)}`} aria-label="履歴書仕上がり見本">
      <article className="pdf-page resume-page resume-a4-page resume-a4-page-1" aria-label="履歴書仕上がり見本 1ページ">
        <ResumeHeader resume={resume} pageNumber={1} pageCount={2} printDate={printDate} />
        <div className="resume-page-body resume-a4-body resume-a4-body-1">
          <ResumeProfile resume={resume} printDate={printDate} />
          <ResumeHistoryTable
            variant="a4"
            resume={resume}
            rows={pageData.primaryHistoryRows}
            className="resume-a4-history-primary-area"
            ariaLabel="学歴・職歴 前半"
            minRows={pageData.layout.primaryMin}
          />
        </div>
      </article>
      <article className="pdf-page resume-page resume-a4-page resume-a4-page-2" aria-label="履歴書仕上がり見本 2ページ">
        <div className="resume-a4-page-number" aria-hidden="true">2/2</div>
        <div className="resume-page-body resume-a4-body resume-a4-body-2">
          <ResumeHistoryTable
            variant="a4"
            resume={resume}
            rows={pageData.secondaryHistoryRows}
            className="resume-a4-history-secondary-area"
            ariaLabel="学歴・職歴 後半"
            minRows={pageData.layout.secondaryMin}
          />
          <ResumeTable
            section={pageData.qualificationSection}
            resume={resume}
            minRows={resume.qualifications.length + pageData.layout.qualBlanks}
          />
          <div className="resume-a4-text-stack">
            <ResumeTextBox section={pageData.textSections.motivation} resume={resume} />
            <ResumeTextBox section={pageData.textSections.selfPr} resume={resume} />
            <ResumeTextBox section={pageData.textSections.requests} resume={resume} />
          </div>
          <ResumeMiniGrid resume={resume} />
        </div>
      </article>
    </div>
  );
}

const resumeTableSection = (
  kind: ResumeTableSection['kind'],
  title: string,
  rows: ResumeTableSection['rows'],
): ResumeTableSection => ({
  type: 'table',
  kind,
  title,
  continued: false,
  rows,
});

const resumeTextSection = (
  kind: ResumeTextSection['kind'],
  title: string,
  value: string,
): ResumeTextSection => ({
  type: 'text',
  kind,
  title,
  continued: false,
  value,
});

const prepareResumePageData = (resume: ResumeData, variant: ResumePaperVariant) => {
  const { layout, primaryRows, secondaryRows } = splitResumeHistory(resume.histories, variant);
  return {
    layout,
    primaryHistoryRows: primaryRows,
    secondaryHistoryRows: secondaryRows,
    qualificationSection: resumeTableSection('qualifications', '免許・資格', resume.qualifications),
    textSections: {
      motivation: resumeTextSection('motivation', '志望動機', resume.motivation),
      selfPr: resumeTextSection('selfPr', '自己PR', resume.selfPr),
      requests: resumeTextSection('requests', '本人希望欄', resume.requests),
    },
  };
};

/** A3横・1枚固定レイアウトの履歴書PDF（左カラム: プロフィール＋学歴、右カラム: 資格＋PR） */
export function ResumeA3Page({
  resume,
  printDate = new Date(),
  captureRef,
}: {
  resume: ResumeData;
  printDate?: Date;
  captureRef?: (node: HTMLElement | null) => void;
}) {
  const pageData = prepareResumePageData(resume, 'a3');

  return (
    <div ref={captureRef} className={`pdf-document resume-document resume-a3-document ${pdfFontClass(resume.pdfFontFamily)}`} aria-label="履歴書仕上がり見本">
      <article className="pdf-page resume-a3-page" aria-label="履歴書仕上がり見本 A3横">
        <div className="resume-a3-body">
          <div className="resume-a3-face resume-a3-left-face">
            <ResumeA3ProfileBlock resume={resume} printDate={printDate} />
            <ResumeHistoryTable
              variant="a3"
              resume={resume}
              rows={pageData.primaryHistoryRows}
              className="resume-a3-history-primary-area resume-a3-history-fill"
              ariaLabel="学歴・職歴 前半"
              minRows={pageData.layout.primaryMin}
            />
          </div>
          <div className="resume-a3-face resume-a3-right-face">
            <ResumeHistoryTable
              variant="a3"
              resume={resume}
              rows={pageData.secondaryHistoryRows}
              className="resume-a3-history-secondary-area"
              ariaLabel="学歴・職歴 後半"
              minRows={pageData.layout.secondaryMin}
            />
            <div className="resume-a3-qualification-area">
              <ResumeTable
                section={pageData.qualificationSection}
                resume={resume}
                minRows={resume.qualifications.length + pageData.layout.qualBlanks}
              />
            </div>
            <div className="resume-a3-appeal-grid">
              <ResumeTextBox section={pageData.textSections.motivation} resume={resume} />
              <ResumeTextBox section={pageData.textSections.selfPr} resume={resume} />
            </div>
            <div className="resume-a3-request-mini">
              <ResumeTextBox section={pageData.textSections.requests} resume={resume} />
              <ResumeMiniGrid resume={resume} />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function AccommodationHeader({
  eraMode,
  pageNumber,
  pageCount,
}: {
  eraMode: EraMode;
  pageNumber: number;
  pageCount: number;
}) {
  return (
    <header className="resume-title-row">
      <h2>就労上の配慮事項シート</h2>
      <div className="resume-date">
        作成日: {formatDate(new Date(), eraMode)} / {pageNumber}/{pageCount}
      </div>
    </header>
  );
}

function AccommodationSection({
  section,
  accommodation,
}: {
  section: AccommodationPrintSection;
  accommodation: AccommodationData;
}) {
  if (section.type === 'empty') {
    return <p className="empty-print">出力対象の項目がありません。</p>;
  }

  return (
    <section className={section.sensitive ? 'sensitive-field' : ''}>
      <h3>{sectionTitle(section.label, section.continued)}</h3>
      <p className={alignmentFor(accommodation.textAlignments, section.fieldKey)}>{section.value}</p>
    </section>
  );
}

/** 配慮事項シートPDF（動的ページ分割: 内容量に応じてページ数が増える） */
export function AccommodationPage({
  accommodation,
  eraMode = 'western',
  pdfFontFamily = 'gothic',
  captureRef,
}: {
  accommodation: AccommodationData;
  eraMode?: EraMode;
  pdfFontFamily?: PdfFontFamily;
  captureRef?: (node: HTMLElement | null) => void;
}) {
  const pages = buildAccommodationPrintPages(accommodation);
  return (
    <div ref={captureRef} className={`pdf-document accommodation-document ${pdfFontClass(pdfFontFamily)}`} aria-label="配慮事項シート仕上がり見本">
      {pages.map((page) => (
        <article key={page.id} className="pdf-page accommodation-page" aria-label={`配慮事項シート仕上がり見本 ${page.pageNumber}ページ`}>
          <AccommodationHeader eraMode={eraMode} pageNumber={page.pageNumber} pageCount={pages.length} />
          {page.showNote ? (
            <p className="sheet-note">
              この書類は、応募先へ伝える必要がある範囲だけを本人が選んで作成する補助資料です。
            </p>
          ) : null}
          <div className="accommodation-list">
            {page.sections.map((section, index) => (
              <AccommodationSection key={`${section.type}-${index}`} section={section} accommodation={accommodation} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
