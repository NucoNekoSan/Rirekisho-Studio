// メイン画面: 入力フォーム・プレビュー・PDF出力を統合した単一ページアプリケーション
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import './App.css';
import { EditableRows } from './components/EditableRows';
import { DocumentManager } from './components/DocumentManager';
import { FormSection, TextField, TextArea, SelectField, ToggleText } from './components/FormFields';
import { OutputPanel } from './components/OutputPanel';
import { AccommodationPage, ResumeA3Page, ResumePage } from './components/PdfPages';
import { PreviewPanel, type PreviewPage, type PreviewScale } from './components/PreviewPanel';
import { getAccommodationPrintFields } from './lib/accommodation';
import { PHOTO_ACCEPTED_EXTENSIONS, PHOTO_MAX_FILE_SIZE_MB, RESUME_APPEAL_MAX_LENGTH } from './lib/config';
import { calculateAgeFromDateInput } from './lib/dateFormat';
import { createDefaultState, createDisabilityEmploymentDemoState } from './lib/defaults';
import { downloadPdfFromElements, openPdfFromElements, type PdfSourceElement } from './browser/pdfRenderer';
import { processPhotoFile, rotatePhotoClockwise } from './browser/photoLoader';
import { downloadTextFile } from './browser/downloadFile';
import type { OfficeFormat } from './browser/officeRenderer';
import { buildAccommodationPrintPages, buildResumePrintPages } from './lib/printPagination';
import { parseProjectFileDocument, serializeProjectFile } from './lib/projectFile';
import { resumeRepository } from './lib/resumeRepository';
import { usePostalLookup, type PostalLookupState } from './hooks/usePostalLookup';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useGridKeyboardNav } from './hooks/useGridKeyboardNav';
import { useResumeEditor } from './hooks/useResumeEditor';
import { getResumeSectionStatus, sectionStatusClass, type SectionStatus } from './lib/sectionStatus';
import { applyTextLengthLimit } from './lib/textInput';
import { sitePath } from './lib/sitePath';
import type { LocalStorageConsent, PdfPaperFormat, ResumeDocumentMetadata } from './lib/types';

/** 左メニューに表示するセクション一覧（表示順＝この配列の順序） */
const sections = [
  { id: 'basic', label: '基本情報' },
  { id: 'photo', label: '写真' },
  { id: 'history', label: '学歴・職歴' },
  { id: 'license', label: '免許・資格' },
  { id: 'appeal', label: '志望動機・希望' },
  { id: 'accommodation', label: '配慮事項' },
  { id: 'output', label: '保存・出力' },
] as const;

type SectionId = (typeof sections)[number]['id'];
type PostalLookupTarget = 'primary' | 'contact';
type ExpandedTextField = 'motivation' | 'selfPr' | 'memo';

const expandedTextFieldDetails: Record<ExpandedTextField, { label: string; maxLength?: number; description: string }> = {
  motivation: { label: '志望動機', maxLength: RESUME_APPEAL_MAX_LENGTH, description: '応募先で働きたい理由を、文章全体を見ながら編集できます。' },
  selfPr: { label: '自己PR', maxLength: RESUME_APPEAL_MAX_LENGTH, description: '得意なことや取り組んできたことを、文章全体を見ながら編集できます。' },
  memo: { label: '作業メモ', description: '書き出しファイルには含まれない自分用のメモを、文章全体を見ながら編集できます。' },
};

const pdfPaperLabel = (format: PdfPaperFormat) => (format === 'a3-landscape' ? 'A3横' : 'A4縦');
const A4_PDF_OUTPUT_BLOCK_MESSAGE = '現在の入力量はA4縦2ページに収まらないため、PDFを表示・保存できません。内容を短くするか、A3横を選択してください。';
const appealLengthError = (label: string, value: string) => (
  value.length > RESUME_APPEAL_MAX_LENGTH
    ? `${label}は${RESUME_APPEAL_MAX_LENGTH}文字以内にしてください（現在${value.length}文字）。`
    : ''
);

function App() {
  // --- アプリケーション状態 ---
  const {
    state,
    setState,
    resume,
    accommodation,
    basicFieldErrors,
    clearBasicFieldErrors,
    setResume,
    updateBasic,
    handleBasicFieldBlur,
    updateResumeField,
    updateAccommodationField,
    updateResumeAlignment,
    resumeAlignmentProps,
    accommodationAlignmentProps,
    updateHistory,
    updateQualification,
    addHistory,
    addQualification,
    removeRow,
    moveRow,
  } = useResumeEditor();
  const [activeSection, setActiveSection] = useState<SectionId>('basic');
  const [includePhotoInProject, setIncludePhotoInProject] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingOffice, setIsGeneratingOffice] = useState(false);
  const [storageConsent, setStorageConsent] = useState<LocalStorageConsent>(() =>
    localStorage.getItem('rirekisho-studio:storage-consent') === 'device-storage' ? 'device-storage' : 'memory-only');
  const [documentId, setDocumentId] = useState<string>(() => crypto.randomUUID());
  const [documentName, setDocumentName] = useState('名称未設定の履歴書');
  const [savedDocuments, setSavedDocuments] = useState<ResumeDocumentMetadata[]>([]);
  const isOnline = useOnlineStatus();
  const { handleKeyDown: gridKeyDown } = useGridKeyboardNav();

  // --- プレビュー表示状態 ---
  const [previewScale, setPreviewScale] = useState<PreviewScale>('fit');
  const [previewPage, setPreviewPage] = useState<PreviewPage>('resume');
  const [previewFrameHeight, setPreviewFrameHeight] = useState<number | null>(null);
  const [previewA4PageCount, setPreviewA4PageCount] = useState<number | null>(null);
  const [visibleFormattingSections, setVisibleFormattingSections] = useState<Partial<Record<SectionId, boolean>>>({});
  const [expandedTextField, setExpandedTextField] = useState<ExpandedTextField | null>(null);

  // --- DOM参照（PDF出力用の隠しDOM要素とダイアログ） ---
  const exportResumeRef = useRef<HTMLElement | null>(null);
  const exportAccommodationRef = useRef<HTMLElement | null>(null);
  const previewPagesRef = useRef<HTMLDivElement | null>(null);
  const previewContentRef = useRef<HTMLElement | null>(null);
  const clearDialogRef = useRef<HTMLDialogElement | null>(null);
  const previewDialogRef = useRef<HTMLDialogElement | null>(null);
  const expandedTextDialogRef = useRef<HTMLDialogElement | null>(null);
  const expandedTextOriginRef = useRef<HTMLTextAreaElement | null>(null);

  // --- 派生値（stateから算出されるUI表示用の値） ---
  const accommodationFields = useMemo(() => getAccommodationPrintFields(accommodation), [accommodation]);
  const hasAccommodation = resume.enabledSupplements.includes('accommodation');
  const activePreviewPage: PreviewPage = hasAccommodation ? previewPage : 'resume';
  const resumePaperFormat = resume.pdfPaperFormat;
  const resumePaperFormatLabel = pdfPaperLabel(resumePaperFormat);
  const activePreviewFormat = activePreviewPage === 'resume' ? resumePaperFormatLabel : 'A4縦';
  const previewPaperClass = activePreviewPage === 'resume' ? `preview-paper-${resumePaperFormat}` : 'preview-paper-a4-portrait';
  const resumeA4PageCount = useMemo(() => buildResumePrintPages(resume).length, [resume]);
  const accommodationA4PageCount = useMemo(() => buildAccommodationPrintPages(accommodation).length, [accommodation]);
  const resumeA4PageWarning = resumePaperFormat === 'a4-portrait' && resumeA4PageCount > 2;
  const resumeA3DensityWarning = resumePaperFormat === 'a3-landscape' && resumeA4PageCount > 2;
  const accommodationPageWarning = hasAccommodation && accommodationA4PageCount > 1;
  const motivationLengthError = appealLengthError('志望動機', resume.motivation);
  const selfPrLengthError = appealLengthError('自己PR', resume.selfPr);
  const resumeAppealLengthWarning = [motivationLengthError, selfPrLengthError].filter(Boolean).join(' ');
  const isPdfOutputBlocked = Boolean(resumeAppealLengthWarning) || resumeA4PageWarning;
  const pdfOutputBlockReason = resumeAppealLengthWarning || A4_PDF_OUTPUT_BLOCK_MESSAGE;
  const calculatedAge = calculateAgeFromDateInput(resume.basic.birthDate, new Date());
  const expandedTextDetails = expandedTextField ? expandedTextFieldDetails[expandedTextField] : null;
  const expandedTextValue = expandedTextField ? resume[expandedTextField] : '';

  const openExpandedTextEditor = (field: ExpandedTextField, origin: HTMLTextAreaElement) => {
    expandedTextOriginRef.current = origin;
    setExpandedTextField(field);
  };

  const handleExpandedTextDialogClose = () => {
    setExpandedTextField(null);
    const origin = expandedTextOriginRef.current;
    expandedTextOriginRef.current = null;
    requestAnimationFrame(() => origin?.focus());
  };

  useEffect(() => {
    if (!expandedTextField) return;
    const dialog = expandedTextDialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [expandedTextField]);

  // --- 郵便番号→住所自動検索 ---
  const primaryLookup = usePostalLookup({
    postalCode: resume.basic.postalCode,
    currentAddress: resume.basic.address,
    setAddress: (address) =>
      setResume((current) => ({ ...current, basic: { ...current.basic, address } })),
  });

  const contactLookup = usePostalLookup({
    postalCode: resume.basic.contactPostalCode,
    currentAddress: resume.basic.contactAddress,
    setAddress: (contactAddress) =>
      setResume((current) => ({ ...current, basic: { ...current.basic, contactAddress } })),
  });

  const postalLookups: Record<PostalLookupTarget, PostalLookupState> = {
    primary: primaryLookup.lookup,
    contact: contactLookup.lookup,
  };

  const applyPostalLookupCandidate = (target: PostalLookupTarget) => {
    (target === 'primary' ? primaryLookup : contactLookup).applyCandidate();
  };

  const resetPostalLookups = () => {
    primaryLookup.reset();
    contactLookup.reset();
  };

  const resetEphemeralState = (resetSaveOptions = false) => {
    resetPostalLookups();
    clearBasicFieldErrors();
    if (resetSaveOptions) setIncludePhotoInProject(false);
    setErrorMessage('');
  };

  // プレビューの高さ・ページ数をCSSスケールから逆算して同期する
  useEffect(() => {
    const content = previewContentRef.current;
    const wrapper = previewPagesRef.current;
    if (!content || !wrapper) {
      setPreviewFrameHeight(null);
      setPreviewA4PageCount(null);
      return;
    }

    const updatePreviewMetrics = () => {
      const scale = Number.parseFloat(getComputedStyle(wrapper).getPropertyValue('--preview-scale'));
      const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
      const contentHeight = content.offsetHeight;
      if (contentHeight <= 0) return;

      const nextFrameHeight = Math.ceil(contentHeight * safeScale);
      const nextPageCount = Math.max(1, content.querySelectorAll('.pdf-page').length);

      setPreviewFrameHeight((current) => (current === nextFrameHeight ? current : nextFrameHeight));
      setPreviewA4PageCount((current) => (current === nextPageCount ? current : nextPageCount));
    };

    updatePreviewMetrics();
    window.addEventListener('resize', updatePreviewMetrics);
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', updatePreviewMetrics);
    }

    const observer = new ResizeObserver(updatePreviewMetrics);
    observer.observe(content);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePreviewMetrics);
    };
  }, [activePreviewPage, previewScale, resume, accommodation]);

  const isFormattingVisible = (sectionId: SectionId) => visibleFormattingSections[sectionId] === true;

  const toggleFormattingSection = (sectionId: SectionId) => {
    setVisibleFormattingSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };

  const sectionStatus = (sectionId: SectionId): SectionStatus => {
    return getResumeSectionStatus(sectionId, resume, accommodationFields.length > 0);
  };

  const goToSection = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const enableAccommodation = () => {
    updateResumeField('enabledSupplements', ['accommodation']);
    setPreviewPage('accommodation');
    setActiveSection('accommodation');
    setStatusMessage('追加書類として配慮事項シートを有効にしました。');
  };

  const refreshSavedDocuments = async () => {
    const result = await resumeRepository.list();
    if (result.ok) setSavedDocuments(result.value);
    else setErrorMessage(result.error);
  };

  useEffect(() => {
    if (storageConsent === 'device-storage') void refreshSavedDocuments();
  }, [storageConsent]);

  useEffect(() => {
    if (storageConsent !== 'device-storage') return;
    const timer = window.setTimeout(async () => {
      const timestamp = new Date().toISOString();
      const result = await resumeRepository.save({
        id: documentId,
        name: documentName.trim() || '名称未設定の履歴書',
        createdAt: state.resume.createdAt || timestamp,
        updatedAt: timestamp,
        state,
      });
      if (result.ok) await refreshSavedDocuments();
      else {
        setStorageConsent('memory-only');
        localStorage.setItem('rirekisho-studio:storage-consent', 'memory-only');
        setErrorMessage(`${result.error} 入力内容は画面に保持しています。JSONファイルへ保存してください。`);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, storageConsent, documentId, documentName]);

  const changeStorageConsent = (consent: LocalStorageConsent) => {
    setStorageConsent(consent);
    localStorage.setItem('rirekisho-studio:storage-consent', consent);
    setStatusMessage(consent === 'device-storage'
      ? 'この端末への自動保存を有効にしました。'
      : '端末への自動保存を停止しました。保存済み書類は削除操作を行うまで残ります。');
  };

  const createDocument = () => {
    setState(createDefaultState());
    setDocumentId(crypto.randomUUID());
    setDocumentName('名称未設定の履歴書');
    resetEphemeralState(true);
    setStatusMessage('新しい履歴書を作成しました。');
  };

  const openDocument = async (id: string) => {
    const result = await resumeRepository.get(id);
    if (!result.ok) return setErrorMessage(result.error);
    if (!result.value) return setErrorMessage('保存した履歴書が見つかりません。');
    setState(result.value.state);
    setDocumentId(result.value.id);
    setDocumentName(result.value.name);
    resetEphemeralState();
    setStatusMessage('端末に保存した履歴書を開きました。');
  };

  const duplicateDocument = async (id: string) => {
    const result = await resumeRepository.duplicate(id);
    if (!result.ok) return setErrorMessage(result.error);
    await refreshSavedDocuments();
    setStatusMessage('履歴書を複製しました。');
  };

  const deleteDocument = async (id: string) => {
    const result = await resumeRepository.delete(id);
    if (!result.ok) return setErrorMessage(result.error);
    if (id === documentId) createDocument();
    await refreshSavedDocuments();
    setStatusMessage('端末から履歴書を削除しました。');
  };

  const clearSavedDocuments = async () => {
    const result = await resumeRepository.clear();
    if (!result.ok) return setErrorMessage(result.error);
    setStorageConsent('memory-only');
    localStorage.setItem('rirekisho-studio:storage-consent', 'memory-only');
    setSavedDocuments([]);
    createDocument();
    setStatusMessage('この端末に保存された履歴書をすべて削除し、自動保存を停止しました。');
  };

  // --- 写真処理 ---
  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage('');
    try {
      const photo = await processPhotoFile(file);
      setResume((current) => ({ ...current, photo }));
      setStatusMessage('写真を取り込み、履歴書用の比率で切り抜きました。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '写真を取り込めませんでした。');
    }
  };

  const rotatePhoto = async () => {
    if (!resume.photo) return;
    setErrorMessage('');
    try {
      const photo = await rotatePhotoClockwise(resume.photo);
      setResume((current) => ({ ...current, photo }));
      setStatusMessage('写真を90度回転しました。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '写真を回転できませんでした。');
    }
  };

  // --- プロジェクトファイル保存・読込 ---
  const saveProject = () => {
    const text = serializeProjectFile(state, includePhotoInProject, documentId, documentName);
    downloadTextFile('rirekisho-studio-project.json', text);
    const photoMessage = includePhotoInProject ? '写真あり' : '写真なし';
    const accommodationMessage = hasAccommodation ? '配慮事項あり' : '配慮事項なし';
    setStatusMessage(`入力データを保存しました（${photoMessage}、${accommodationMessage}）。`);
  };

  const loadProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const project = parseProjectFileDocument(text);
      setState(project.state);
      setDocumentId(project.documentId);
      setDocumentName(project.documentName);
      resetEphemeralState();
      setStatusMessage('入力データを読み込みました。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '入力データを読み込めませんでした。');
    }
  };

  const clearAll = () => {
    setState(createDefaultState());
    resetEphemeralState(true);
    setStatusMessage('この画面上の入力内容を消去しました。');
    clearDialogRef.current?.close();
  };

  const applyDisabilityEmploymentDemo = (paperFormat: PdfPaperFormat) => {
    const demoState = createDisabilityEmploymentDemoState();
    setState({
      ...demoState,
      resume: {
        ...demoState.resume,
        pdfPaperFormat: paperFormat,
      },
    });
    resetEphemeralState(true);
    setPreviewPage('resume');
    setStatusMessage(`${pdfPaperLabel(paperFormat)}・配慮事項付きデモを入力しました。右側の仕上がり見本で確認できます。`);
  };

  // --- PDF生成（隠しDOMからページ要素を収集→html2canvas→jsPDF） ---
  const pdfElements = (includeAccommodation: boolean): PdfSourceElement[] => {
    const elements: PdfSourceElement[] = exportResumeRef.current
      ? Array.from(exportResumeRef.current.querySelectorAll<HTMLElement>('.pdf-page')).map((element) => ({
          element,
          paperFormat: resumePaperFormat,
        }))
      : [];
    if (includeAccommodation && exportAccommodationRef.current) {
      elements.push(...Array.from(exportAccommodationRef.current.querySelectorAll<HTMLElement>('.pdf-page')).map((element) => ({
        element,
        paperFormat: 'a4-portrait' as const,
      })));
    }
    return elements;
  };

  const capturePreviewContent = (node: HTMLElement | null) => {
    previewContentRef.current = node;
  };

  const runPdfAction = async (mode: 'open' | 'download', includeAccommodation: boolean) => {
    if (isPdfOutputBlocked) {
      setErrorMessage(pdfOutputBlockReason);
      return;
    }
    const elements = pdfElements(includeAccommodation);
    if (elements.length === 0) return;
    setIsGeneratingPdf(true);
    setErrorMessage('');
    try {
      const fileName = includeAccommodation
        ? (resumePaperFormat === 'a3-landscape' ? 'rirekisho-a3-and-accommodation.pdf' : 'rirekisho-and-accommodation.pdf')
        : (resumePaperFormat === 'a3-landscape' ? 'rirekisho-a3.pdf' : 'rirekisho.pdf');
      if (mode === 'open') {
        await openPdfFromElements(elements, fileName);
      } else {
        await downloadPdfFromElements(elements, fileName);
      }
      setStatusMessage('PDFを生成しました。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PDFを生成できませんでした。');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const runOfficeAction = async (format: OfficeFormat, includeAccommodation: boolean) => {
    setIsGeneratingOffice(true);
    setErrorMessage('');
    try {
      const { downloadOfficeDocument } = await import('./browser/officeRenderer');
      await downloadOfficeDocument(format, resume, accommodation, includeAccommodation);
      setStatusMessage(`${format === 'docx' ? 'Word' : 'Excel'}ファイルを保存しました。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ファイルを生成できませんでした。');
    } finally {
      setIsGeneratingOffice(false);
    }
  };

  const openPreviewDialog = () => {
    previewDialogRef.current?.showModal();
  };

  const renderResumePdf = (captureRef?: (node: HTMLElement | null) => void) =>
    resumePaperFormat === 'a3-landscape'
      ? <ResumeA3Page resume={resume} captureRef={captureRef} />
      : <ResumePage resume={resume} captureRef={captureRef} />;

  const basicFormattingVisible = isFormattingVisible('basic');
  const historyFormattingVisible = isFormattingVisible('history');
  const licenseFormattingVisible = isFormattingVisible('license');
  const appealFormattingVisible = isFormattingVisible('appeal');
  const accommodationFormattingVisible = isFormattingVisible('accommodation');

  // --- JSX描画 ---
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">入力フォームへスキップ</a>
      <header className="app-header">
        <div>
          <h1><a className="app-brand" href={sitePath('')}>Rirekisho Studio</a></h1>
          <p className="header-copy">日本向けの履歴書を、端末の中だけで安全に作成できます。</p>
        </div>
        <nav aria-label="サービス情報">
          <a href={sitePath('manual/')}>使い方</a>
          <a href={sitePath('privacy')}>プライバシー</a>
          <a href={sitePath('terms')}>利用規約</a>
        </nav>
      </header>

      <main id="main-content" className="workspace" tabIndex={-1}>
        <aside className="side-panel" aria-label="作成メニュー">
          <section className="application-card">
            <h2>追加書類</h2>
            <label className="check-row">
              <input
                type="checkbox"
                checked={hasAccommodation}
                onChange={(event) => updateResumeField('enabledSupplements', event.target.checked ? ['accommodation'] : [])}
              />
              配慮事項シートを作成する
            </label>
            <p>必要な場合だけ、履歴書とは別の追加書類として作成できます。</p>
          </section>

          <DocumentManager
            consent={storageConsent}
            documents={savedDocuments}
            currentId={documentId}
            currentName={documentName}
            onConsentChange={changeStorageConsent}
            onNameChange={setDocumentName}
            onCreate={createDocument}
            onOpen={openDocument}
            onDuplicate={duplicateDocument}
            onDelete={deleteDocument}
            onClear={clearSavedDocuments}
          />

          <nav className="section-nav" aria-label="入力セクション">
            {sections.map((section) => {
              const status = sectionStatus(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  className={activeSection === section.id ? 'active' : ''}
                  aria-current={activeSection === section.id ? 'true' : undefined}
                  onClick={() => goToSection(section.id)}
                >
                  <span>{section.label}</span>
                  <span className={`section-state ${sectionStatusClass(status)}`}>
                    {status}
                  </span>
                </button>
              );
            })}
          </nav>

          <nav className="section-nav side-panel-jump-nav" aria-label="ページ内ジャンプ">
            <button
              type="button"
              onClick={() => document.getElementById('preview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <span>仕上がり見本へ移動</span>
              <span className="section-state">→</span>
            </button>
            <button
              type="button"
              onClick={() => window.open(`${import.meta.env.BASE_URL}manual/index.html`, '_blank', 'noopener')}
            >
              <span>マニュアルを開く</span>
              <span className="section-state">↗</span>
            </button>
          </nav>
        </aside>

        <section className="editor" aria-label="履歴書入力フォーム">
          {!isOnline ? <div className="notice offline-notice" role="status">オフラインです。郵便番号検索は利用できません。</div> : null}
          {statusMessage ? <div className="notice" role="status">{statusMessage}</div> : null}
          {errorMessage ? <div className="alert" role="alert">{errorMessage}</div> : null}

          <FormSection
              id="basic"
              title="基本情報"
              description="氏名、住所、連絡先を入力します。"
              guidance={[
                '郵便番号や電話番号はハイフンなしで入力できます。',
                '年齢は生年月日から自動計算されます。年齢欄への直接入力は不要です。',
                '入力欄の下にある注意を確認しながら進めてください。',
              ]}
              status={sectionStatus('basic')}
              formattingVisible={basicFormattingVisible}
              onToggleFormatting={() => toggleFormattingSection('basic')}
            >
              <div className="form-grid two" onKeyDown={gridKeyDown}>
                <TextField label="氏名" value={resume.basic.name} onChange={(value) => updateBasic('name', value)} autoComplete="name" placeholder="山田 太郎" showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.name')} />
                <TextField label="ふりがな" value={resume.basic.furigana} onChange={(value) => updateBasic('furigana', value)} placeholder="やまだ たろう" showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.furigana')} />
                <TextField label="生年月日" type="date" value={resume.basic.birthDate} onChange={(value) => updateBasic('birthDate', value)} autoComplete="bday" hint="年齢計算に使います。" showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.birthDate')} />
                <TextField label="年齢" value={calculatedAge} onChange={() => undefined} readOnly hint="生年月日から自動計算します。" showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.age')} />
                <fieldset className="field choice-field">
                  <legend>PDFの日付表示</legend>
                  <div className="segmented-radios">
                    <label><input type="radio" name="eraMode" checked={resume.eraMode === 'western'} onChange={() => updateResumeField('eraMode', 'western')} />西暦</label>
                    <label><input type="radio" name="eraMode" checked={resume.eraMode === 'japanese'} onChange={() => updateResumeField('eraMode', 'japanese')} />和暦</label>
                  </div>
                </fieldset>
                <SelectField label="性別欄" value={resume.basic.gender} onChange={(value) => updateBasic('gender', value)} showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.gender')}>
                  <option value="">未選択</option><option value="female">女性</option><option value="male">男性</option><option value="no_answer">回答しない</option><option value="hidden">出力に含めない</option>
                </SelectField>
                <div className="postal-field">
                  <TextField label="郵便番号" value={resume.basic.postalCode} onChange={(value) => updateBasic('postalCode', value)} onBlur={() => handleBasicFieldBlur('postalCode')} autoComplete="postal-code" inputMode="numeric" placeholder="1600022" guidance={['7桁の数字で入力できます。ハイフンは入力後に自動で入ります。', '住所検索では、郵便番号だけを外部の住所検索サービスに送ります。']} error={basicFieldErrors.postalCode} showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.postalCode')} />
                  <PostalLookupFeedback addressLabel="現住所" lookup={postalLookups.primary} onApply={() => applyPostalLookupCandidate('primary')} />
                </div>
                <TextField label="現住所" value={resume.basic.address} onChange={(value) => updateBasic('address', value)} autoComplete="street-address" placeholder="東京都新宿区新宿1-2-3 サンプルハイツ101" guidance="郵便番号で自動入力された場合も、番地・建物名を確認してください。" showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.address')} />
                <TextField label="電話番号" type="tel" value={resume.basic.phone} onChange={(value) => updateBasic('phone', value)} onBlur={() => handleBasicFieldBlur('phone')} autoComplete="tel" inputMode="tel" placeholder="09012345678" guidance="ハイフンなしで入力できます。入力欄を離れると自動で整えます。" error={basicFieldErrors.phone} showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.phone')} />
                <TextField label="メールアドレス" type="email" value={resume.basic.email} onChange={(value) => updateBasic('email', value)} onBlur={() => handleBasicFieldBlur('email')} autoComplete="email" inputMode="email" placeholder="taro.yamada@example.com" guidance="形式が違う場合は、入力欄を離れた後にメッセージを表示します。" error={basicFieldErrors.email} showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.email')} />
                <div className="postal-field">
                  <TextField label="連絡先郵便番号" value={resume.basic.contactPostalCode} onChange={(value) => updateBasic('contactPostalCode', value)} onBlur={() => handleBasicFieldBlur('contactPostalCode')} autoComplete="postal-code" inputMode="numeric" placeholder="1600022" guidance={['7桁の数字で入力できます。ハイフンは入力後に自動で入ります。', '住所検索では、郵便番号だけを外部の住所検索サービスに送ります。']} error={basicFieldErrors.contactPostalCode} showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.contactPostalCode')} />
                  <PostalLookupFeedback addressLabel="連絡先住所" lookup={postalLookups.contact} onApply={() => applyPostalLookupCandidate('contact')} />
                </div>
                <TextField label="連絡先住所" value={resume.basic.contactAddress} onChange={(value) => updateBasic('contactAddress', value)} autoComplete="street-address" placeholder="同上" guidance="現住所と同じ場合は「同上」と入力できます。" showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.contactAddress')} />
                <TextField label="連絡先電話番号" type="tel" value={resume.basic.contactPhone} onChange={(value) => updateBasic('contactPhone', value)} onBlur={() => handleBasicFieldBlur('contactPhone')} autoComplete="tel" inputMode="tel" placeholder="09012345678" guidance="ハイフンなしで入力できます。入力欄を離れると自動で整えます。" error={basicFieldErrors.contactPhone} showAlignmentControl={basicFormattingVisible} {...resumeAlignmentProps('basic.contactPhone')} />
              </div>
          </FormSection>

          <FormSection id="photo" title="写真" description={`JPG/JPEG形式、${PHOTO_MAX_FILE_SIZE_MB}MB以下の写真を取り込めます。`} status={sectionStatus('photo')}>
              <div className="photo-editor">
                <div className="photo-preview" aria-label="写真プレビュー">
                  {resume.photo ? <img src={resume.photo.dataUrl} alt="取り込み済みの履歴書用写真" /> : <span>写真なし</span>}
                </div>
                <div className="photo-controls">
                  <label className="file-button">写真を選択
                    <input type="file" accept={PHOTO_ACCEPTED_EXTENSIONS.join(',')} onChange={handlePhotoChange} />
                  </label>
                  <button type="button" onClick={rotatePhoto} disabled={!resume.photo}>90度回転</button>
                  <button type="button" className="ghost-danger" onClick={() => setResume((current) => ({ ...current, photo: null }))} disabled={!resume.photo}>写真を削除</button>
                  <p>取り込んだ写真は中央で4:3縦長に切り抜き、履歴書の写真欄へ配置します。</p>
                </div>
              </div>
          </FormSection>

          <FormSection
              id="history"
              title="学歴・職歴"
              description="年月と内容を入力します。"
              guidance="年月が分からない場合は、卒業証書、雇用契約書、離職票などの手元資料を確認してください。"
              status={sectionStatus('history')}
              formattingVisible={historyFormattingVisible}
              onToggleFormatting={() => toggleFormattingSection('history')}
            >
              <EditableRows rows={resume.histories} groupLabel="学歴・職歴" alignmentKind="histories" alignments={resume.textAlignments} showAlignmentControls={historyFormattingVisible} onAlignmentChange={updateResumeAlignment} onChange={updateHistory} onAdd={addHistory} onRemove={(id) => removeRow('histories', id)} onMove={(id, direction) => moveRow('histories', id, direction)} addLabel="学歴・職歴を追加" onKeyDown={gridKeyDown} />
          </FormSection>

          <FormSection
              id="license"
              title="免許・資格"
              description="取得年月と資格名を入力します。"
              guidance="免許・資格名は、証明書や免許証の表記に合わせると確認しやすくなります。"
              status={sectionStatus('license')}
              formattingVisible={licenseFormattingVisible}
              onToggleFormatting={() => toggleFormattingSection('license')}
            >
              <EditableRows rows={resume.qualifications} groupLabel="免許・資格" alignmentKind="qualifications" alignments={resume.textAlignments} showAlignmentControls={licenseFormattingVisible} onAlignmentChange={updateResumeAlignment} onChange={updateQualification} onAdd={addQualification} onRemove={(id) => removeRow('qualifications', id)} onMove={(id, direction) => moveRow('qualifications', id, direction)} addLabel="免許・資格を追加" onKeyDown={gridKeyDown} />
          </FormSection>

          <FormSection
              id="appeal"
              title="志望動機・本人希望"
              description="応募先に合わせて入力します。"
              guidance={[
                '志望動機・自己PR・本人希望欄は書き出しファイルに含まれます。',
                '作業メモは書き出しファイルに含まれません。下書きや面接前の確認に使えます。',
              ]}
              status={sectionStatus('appeal')}
              formattingVisible={appealFormattingVisible}
              onToggleFormatting={() => toggleFormattingSection('appeal')}
            >
              <div className="form-grid two" onKeyDown={gridKeyDown}>
                <TextArea label="志望動機" value={resume.motivation} onChange={(value) => updateResumeField('motivation', value)} onExpand={(origin) => openExpandedTextEditor('motivation', origin)} hint="応募先で働きたい理由を書きます（350文字以内）。" guidance="書き出しファイルに含まれる欄です。応募先に見せる内容だけを書きます。" placeholder="応募先で働きたい理由や活かせる経験" maxLength={RESUME_APPEAL_MAX_LENGTH} error={motivationLengthError} showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.motivation')} />
                <TextArea label="自己PR" value={resume.selfPr} onChange={(value) => updateResumeField('selfPr', value)} onExpand={(origin) => openExpandedTextEditor('selfPr', origin)} hint="得意なこと、取り組んできたことを書きます（350文字以内）。" guidance="書き出しファイルに含まれる欄です。得意なことや続けてきたことを書きます。" placeholder="得意なこと、続けて取り組んできたこと" maxLength={RESUME_APPEAL_MAX_LENGTH} error={selfPrLengthError} showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.selfPr')} />
                <TextArea label="本人希望欄" value={resume.requests} onChange={(value) => updateResumeField('requests', value)} hint="勤務条件などの希望がある場合に記入します。特にない場合は「貴社規定に従います。」など。" guidance="書き出しファイルに含まれる欄です。応募先へ伝える内容だけを書きます。" placeholder="貴社規定に従います" showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.requests')} />
                <TextArea label="作業メモ" value={resume.memo} onChange={(value) => updateResumeField('memo', value)} onExpand={(origin) => openExpandedTextEditor('memo', origin)} hint="下書きや確認事項のためのメモ欄です（書き出しファイルには含まれません）。" guidance="このメモは書き出しファイルに含まれません。面接前の確認や下書きに使えます。" placeholder="面接前に確認したいこと" showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.memo')} />
                <TextField label="通勤時間" value={resume.commuteTime} onChange={(value) => updateResumeField('commuteTime', value)} placeholder="約45分" showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.commuteTime')} />
                <TextField label="扶養家族" value={resume.dependents} onChange={(value) => updateResumeField('dependents', value)} placeholder="0人" showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.dependents')} />
                <TextField label="配偶者" value={resume.spouse} onChange={(value) => updateResumeField('spouse', value)} placeholder="無" showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.spouse')} />
                <TextField label="配偶者の扶養義務" value={resume.spouseSupport} onChange={(value) => updateResumeField('spouseSupport', value)} placeholder="無" showAlignmentControl={appealFormattingVisible} {...resumeAlignmentProps('resume.spouseSupport')} />
              </div>
          </FormSection>

          <FormSection
              id="accommodation"
              title="配慮事項シート"
              description="必要な場合だけ、履歴書とは別の追加書類として作成します。"
              guidance={hasAccommodation
                ? ['配慮事項シートは保存する内容で選んだ場合だけ、別ページまたは別シートに含まれます。', '応募先に共有してよい範囲だけ入力してください。']
                : '追加書類を有効にしない限り、配慮事項は入力・出力されません。'}
              status={sectionStatus('accommodation')}
              formattingVisible={accommodationFormattingVisible}
              onToggleFormatting={hasAccommodation ? () => toggleFormattingSection('accommodation') : undefined}
            >
              {!hasAccommodation ? (
                <div className="accommodation-locked">
                  <h3>配慮事項シートは無効です</h3>
                  <p>障害名、手帳、通院、服薬などの機微情報は、必要な場合だけ追加書類として入力できます。</p>
                  <button type="button" onClick={enableAccommodation}>配慮事項シートを有効にする</button>
                </div>
              ) : (
                <div className="form-grid two" onKeyDown={gridKeyDown}>
                  <ToggleText label="障害名・診断名" enabled={accommodation.includeDisabilityName} value={accommodation.disabilityName} onToggle={(value) => updateAccommodationField('includeDisabilityName', value)} onChange={(value) => updateAccommodationField('disabilityName', value)} placeholder="必要な範囲で記入します" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('disabilityName')} />
                  <ToggleText label="障害者手帳等" enabled={accommodation.includeCertificate} value={accommodation.certificate} onToggle={(value) => updateAccommodationField('includeCertificate', value)} onChange={(value) => updateAccommodationField('certificate', value)} placeholder="精神障害者保健福祉手帳 3級" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('certificate')} />
                  <ToggleText label="通院状況" enabled={accommodation.includeHospitalVisit} value={accommodation.hospitalVisit} onToggle={(value) => updateAccommodationField('includeHospitalVisit', value)} onChange={(value) => updateAccommodationField('hospitalVisit', value)} placeholder="月1回、主治医の診察があります" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('hospitalVisit')} />
                  <ToggleText label="服薬・体調管理" enabled={accommodation.includeMedication} value={accommodation.medication} onToggle={(value) => updateAccommodationField('includeMedication', value)} onChange={(value) => updateAccommodationField('medication', value)} placeholder="服薬により体調は安定しています" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('medication')} />
                  <ToggleText label="相談先・連絡先" enabled={accommodation.includeSupportContact} value={accommodation.supportContact} onToggle={(value) => updateAccommodationField('includeSupportContact', value)} onChange={(value) => updateAccommodationField('supportContact', value)} placeholder="相談機関名、担当者名など（必要な場合のみ）" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('supportContact')} />
                  <TextArea label="得意なこと・強み" value={accommodation.strengths} onChange={(value) => updateAccommodationField('strengths', value)} guidance="配慮事項シートに出力されます。応募先に共有してよい範囲で入力します。" placeholder="手順が決まっている作業を丁寧に続けられます" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('strengths')} />
                  <TextArea label="苦手な環境・状況" value={accommodation.difficultSituations} onChange={(value) => updateAccommodationField('difficultSituations', value)} guidance="配慮事項シートに出力されます。業務上相談したい内容を中心に書きます。" placeholder="急な予定変更が続くと混乱しやすいです" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('difficultSituations')} />
                  <TextArea label="お願いしたい配慮" value={accommodation.requestedAccommodations} onChange={(value) => updateAccommodationField('requestedAccommodations', value)} guidance="配慮事項シートに出力されます。働く上で必要な配慮を具体的に書きます。" placeholder="指示は口頭だけでなくメモでも確認できると助かります" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('requestedAccommodations')} />
                  <TextArea label="自分で行っている工夫" value={accommodation.selfCare} onChange={(value) => updateAccommodationField('selfCare', value)} guidance="配慮事項シートに出力されます。自分で取り組んでいる対策を書きます。" placeholder="作業前にメモを確認し、優先順位を整理しています" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('selfCare')} />
                  <TextArea label="体調悪化時のサイン" value={accommodation.warningSigns} onChange={(value) => updateAccommodationField('warningSigns', value)} guidance="配慮事項シートに出力されます。早めに気づける変化があれば書きます。" placeholder="集中が続かない、確認が増えるなどの傾向があります" showAlignmentControl={accommodationFormattingVisible} {...accommodationAlignmentProps('warningSigns')} />
                </div>
              )}
          </FormSection>

          <FormSection id="output" title="保存・ファイル出力" description="サーバーには保存しません。必要な場合は入力データをダウンロードしてください。">
              <OutputPanel
                resume={resume}
                accommodation={accommodation}
                resumePaperFormatLabel={resumePaperFormatLabel}
                resumeA4PageCount={resumeA4PageCount}
                resumeA4PageWarning={resumeA4PageWarning}
                resumeA3DensityWarning={resumeA3DensityWarning}
                resumeAppealLengthWarning={resumeAppealLengthWarning}
                accommodationFieldCount={accommodationFields.length}
                accommodationA4PageCount={accommodationA4PageCount}
                accommodationPageWarning={accommodationPageWarning}
                includePhotoInProject={includePhotoInProject}
                setIncludePhotoInProject={setIncludePhotoInProject}
                updateResumeField={updateResumeField}
                applyDisabilityEmploymentDemo={applyDisabilityEmploymentDemo}
                saveProject={saveProject}
                loadProject={loadProject}
                onClear={() => clearDialogRef.current?.showModal()}
              />
          </FormSection>
        </section>

        <PreviewPanel
          previewScale={previewScale}
          setPreviewScale={setPreviewScale}
          showPageTabs={hasAccommodation}
          activePreviewPage={activePreviewPage}
          setPreviewPage={setPreviewPage}
          resumePaperFormatLabel={resumePaperFormatLabel}
          activePreviewFormat={activePreviewFormat}
          previewA4PageCount={previewA4PageCount}
          showAccommodationButtons={hasAccommodation}
          isGeneratingPdf={isGeneratingPdf}
          isGeneratingOffice={isGeneratingOffice}
          isPdfOutputBlocked={isPdfOutputBlocked}
          pdfOutputBlockReason={pdfOutputBlockReason}
          onOpenPreviewDialog={openPreviewDialog}
          runPdfAction={runPdfAction}
          runOfficeAction={runOfficeAction}
          previewPaperClass={previewPaperClass}
          previewPagesRef={previewPagesRef}
          previewFrameHeight={previewFrameHeight}
          resumePreview={renderResumePdf(capturePreviewContent)}
          accommodationPreview={
            <AccommodationPage accommodation={accommodation} eraMode={resume.eraMode} pdfFontFamily={resume.pdfFontFamily} captureRef={capturePreviewContent} />
          }
        />

        {/* PDF出力用の隠しDOM: 画面外に配置し、html2canvasでキャプチャする */}
        <div className="pdf-export-root" aria-hidden="true">
          {renderResumePdf((node) => { exportResumeRef.current = node; })}
          {hasAccommodation ? (
            <AccommodationPage accommodation={accommodation} eraMode={resume.eraMode} pdfFontFamily={resume.pdfFontFamily} captureRef={(node) => { exportAccommodationRef.current = node; }} />
          ) : null}
        </div>
      </main>

      <dialog className="preview-dialog" ref={previewDialogRef} aria-labelledby="preview-dialog-title">
        <form method="dialog">
          <div className="preview-dialog-header">
            <h2 id="preview-dialog-title">見本を大きく見る</h2>
            <button type="submit" className="secondary">閉じる</button>
          </div>
          <div className="preview-dialog-body">
            {activePreviewPage === 'resume' ? (
              renderResumePdf()
            ) : (
              <AccommodationPage accommodation={accommodation} eraMode={resume.eraMode} pdfFontFamily={resume.pdfFontFamily} />
            )}
          </div>
        </form>
      </dialog>

      <dialog
        className="expanded-text-dialog"
        ref={expandedTextDialogRef}
        aria-labelledby="expanded-text-dialog-title"
        aria-describedby="expanded-text-dialog-description"
        onClose={handleExpandedTextDialogClose}
      >
        <form method="dialog">
          <div className="expanded-text-dialog-header">
            <div>
              <h2 id="expanded-text-dialog-title">{expandedTextDetails ? `${expandedTextDetails.label}を大きく編集` : '文章を大きく編集'}</h2>
              <p id="expanded-text-dialog-description">{expandedTextDetails?.description}</p>
            </div>
            <button type="submit" className="secondary">閉じる</button>
          </div>
          <div className="expanded-text-dialog-body">
            <label htmlFor="expanded-text-editor">{expandedTextDetails?.label ?? '文章'}</label>
            <textarea
              id="expanded-text-editor"
              autoFocus
              value={expandedTextValue}
              maxLength={expandedTextDetails?.maxLength}
              onChange={(event) => {
                if (!expandedTextField) return;
                updateResumeField(expandedTextField, applyTextLengthLimit(expandedTextValue, event.target.value, expandedTextDetails?.maxLength));
              }}
            />
            <span className="field-character-count" aria-live="polite">
              {expandedTextDetails?.maxLength
                ? `${expandedTextValue.length} / ${expandedTextDetails.maxLength}文字`
                : `${expandedTextValue.length}文字`}
            </span>
          </div>
        </form>
      </dialog>

      <dialog className="confirm-dialog" ref={clearDialogRef} aria-labelledby="clear-dialog-title" aria-describedby="clear-dialog-description">
        <form method="dialog">
          <h2 id="clear-dialog-title">入力内容をすべて消去しますか</h2>
          <p id="clear-dialog-description">保存していない内容、取り込んだ写真、作成中の配慮事項はこの画面から消えます。この操作は元に戻せません。</p>
          <div className="dialog-actions">
            <button type="submit" className="secondary" value="cancel">キャンセル</button>
            <button type="button" className="danger" onClick={clearAll}>消去する</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

/** 郵便番号検索結果: 住所候補の表示＋反映ボタン */
function PostalLookupFeedback({
  addressLabel,
  lookup,
  onApply,
}: {
  addressLabel: string;
  lookup: PostalLookupState;
  onApply: () => void;
}) {
  if (lookup.status === 'idle') return null;

  const isAlert = lookup.status === 'error' || lookup.status === 'not_found';

  return (
    <div className={`postal-lookup ${lookup.status}`} role={isAlert ? 'alert' : 'status'}>
      <p>{lookup.message}</p>
      {lookup.status === 'candidate' ? (
        <button type="button" className="secondary compact-button" onClick={onApply}>
          {addressLabel}に反映
        </button>
      ) : null}
      <p className="postal-privacy-note">郵便番号のみを住所検索APIへ送信します。</p>
    </div>
  );
}

export default App;
