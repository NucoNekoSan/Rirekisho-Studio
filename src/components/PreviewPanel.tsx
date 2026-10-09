// 仕上がり見本とファイルの書き出し操作
import type { ReactNode, RefObject } from 'react';
import { ExportControls } from './ExportControls';
import type { OfficeFormat } from '../browser/officeRenderer';

export type PreviewScale = 'fit' | 'large';
export type PreviewPage = 'resume' | 'accommodation';

interface PreviewPanelProps {
  previewScale: PreviewScale;
  setPreviewScale: (scale: PreviewScale) => void;
  showPageTabs: boolean;
  activePreviewPage: PreviewPage;
  setPreviewPage: (page: PreviewPage) => void;
  resumePaperFormatLabel: string;
  activePreviewFormat: string;
  previewA4PageCount: number | null;
  showAccommodationButtons: boolean;
  isGeneratingPdf: boolean;
  isGeneratingOffice: boolean;
  isPdfOutputBlocked: boolean;
  pdfOutputBlockReason: string;
  onOpenPreviewDialog: () => void;
  runPdfAction: (mode: 'open' | 'download', includeAccommodation: boolean) => void;
  runOfficeAction: (format: OfficeFormat, includeAccommodation: boolean) => void;
  previewPaperClass: string;
  previewPagesRef: RefObject<HTMLDivElement | null>;
  previewFrameHeight: number | null;
  resumePreview: ReactNode;
  accommodationPreview: ReactNode;
}

function PreviewPageFrame({ children, height }: { children: ReactNode; height: number | null }) {
  return <div className="preview-page-frame" style={height ? { height: `${height}px` } : undefined}>{children}</div>;
}

export function PreviewPanel({
  previewScale,
  setPreviewScale,
  showPageTabs,
  activePreviewPage,
  setPreviewPage,
  resumePaperFormatLabel,
  activePreviewFormat,
  previewA4PageCount,
  showAccommodationButtons,
  isGeneratingPdf,
  isGeneratingOffice,
  isPdfOutputBlocked,
  pdfOutputBlockReason,
  onOpenPreviewDialog,
  runPdfAction,
  runOfficeAction,
  previewPaperClass,
  previewPagesRef,
  previewFrameHeight,
  resumePreview,
  accommodationPreview,
}: PreviewPanelProps) {
  return (
    <aside className="preview-panel" id="preview-panel" aria-labelledby="preview-panel-title">
      <div className="preview-sticky">
        <div className="preview-heading">
          <h2 id="preview-panel-title">仕上がり見本</h2>
          <div className="preview-toolbar" role="group" aria-label="見本の表示倍率">
            <button type="button" className={previewScale === 'fit' ? 'active' : ''} aria-pressed={previewScale === 'fit'} onClick={() => setPreviewScale('fit')}>全体表示</button>
            <button type="button" className={previewScale === 'large' ? 'active' : ''} aria-pressed={previewScale === 'large'} onClick={() => setPreviewScale('large')}>拡大表示</button>
          </div>
        </div>
        {showPageTabs ? (
          <div className="preview-tabs" role="group" aria-label="見本のページ">
            <button type="button" className={activePreviewPage === 'resume' ? 'active' : ''} aria-pressed={activePreviewPage === 'resume'} onClick={() => setPreviewPage('resume')}>履歴書（{resumePaperFormatLabel}）</button>
            <button type="button" className={activePreviewPage === 'accommodation' ? 'active' : ''} aria-pressed={activePreviewPage === 'accommodation'} onClick={() => setPreviewPage('accommodation')}>配慮事項シート（A4縦）</button>
          </div>
        ) : null}
        <p className="preview-note">PDFのレイアウトを使った共通の見本です。Word・Excelの表示を直接確認するものではありません。</p>
        <p className="preview-note">
          {previewA4PageCount
            ? `PDFでは${activePreviewFormat} ${previewA4PageCount}ページとして出力します。`
            : `PDFでは入力内容を意味単位で${activePreviewFormat}ページへ分割します。`}
        </p>
        <button type="button" className="secondary preview-large-button" onClick={onOpenPreviewDialog}>見本を大きく見る</button>
        <ExportControls
          paperFormatLabel={resumePaperFormatLabel}
          showAccommodation={showAccommodationButtons}
          busy={isGeneratingPdf || isGeneratingOffice}
          isPdfOutputBlocked={isPdfOutputBlocked}
          pdfOutputBlockReason={pdfOutputBlockReason}
          runPdfAction={runPdfAction}
          runOfficeAction={runOfficeAction}
        />
        <div className={`preview-pages preview-${previewScale} ${previewPaperClass}`} ref={previewPagesRef}>
          <PreviewPageFrame height={previewFrameHeight}>
            {activePreviewPage === 'resume' ? resumePreview : accommodationPreview}
          </PreviewPageFrame>
        </div>
      </div>
    </aside>
  );
}
