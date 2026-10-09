import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreviewPanel } from './PreviewPanel';

describe('PreviewPanel', () => {
  it('routes preview, scale, dialog, and PDF actions to their handlers', () => {
    const setPreviewScale = vi.fn();
    const setPreviewPage = vi.fn();
    const onOpenPreviewDialog = vi.fn();
    const runPdfAction = vi.fn();
    const runOfficeAction = vi.fn();

    const { rerender } = render(
      <PreviewPanel
        previewScale="fit"
        setPreviewScale={setPreviewScale}
        showPageTabs
        activePreviewPage="resume"
        setPreviewPage={setPreviewPage}
        resumePaperFormatLabel="A3横"
        activePreviewFormat="A3横"
        previewA4PageCount={1}
        showAccommodationButtons
        isGeneratingPdf={false}
        isGeneratingOffice={false}
        isPdfOutputBlocked={false}
        pdfOutputBlockReason=""
        onOpenPreviewDialog={onOpenPreviewDialog}
        runPdfAction={runPdfAction}
        runOfficeAction={runOfficeAction}
        previewPaperClass="preview-paper-a3-landscape"
        previewPagesRef={{ current: null }}
        previewFrameHeight={420}
        resumePreview={<div>履歴書プレビュー</div>}
        accommodationPreview={<div>配慮事項プレビュー</div>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '全体表示' }));
    fireEvent.click(screen.getByRole('button', { name: '拡大表示' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書（A3横）' }));
    fireEvent.click(screen.getByRole('button', { name: '配慮事項シート（A4縦）' }));
    fireEvent.click(screen.getByRole('button', { name: '見本を大きく見る' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書PDFを表示' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書PDFを保存' }));
    fireEvent.click(screen.getByRole('radio', { name: '履歴書と配慮事項' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書と配慮事項PDFを表示' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書と配慮事項PDFを保存' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Word（.docx）' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書と配慮事項Wordを保存' }));
    fireEvent.click(screen.getByRole('radio', { name: '履歴書のみ' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書Wordを保存' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Excel（.xlsx）' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書Excelを保存' }));
    fireEvent.click(screen.getByRole('radio', { name: '履歴書と配慮事項' }));
    fireEvent.click(screen.getByRole('button', { name: '履歴書と配慮事項Excelを保存' }));

    expect(setPreviewScale).toHaveBeenNthCalledWith(1, 'fit');
    expect(setPreviewScale).toHaveBeenNthCalledWith(2, 'large');
    expect(setPreviewPage).toHaveBeenNthCalledWith(1, 'resume');
    expect(setPreviewPage).toHaveBeenNthCalledWith(2, 'accommodation');
    expect(onOpenPreviewDialog).toHaveBeenCalledOnce();
    expect(runPdfAction.mock.calls).toEqual([
      ['open', false],
      ['download', false],
      ['open', true],
      ['download', true],
    ]);
    expect(runOfficeAction.mock.calls).toEqual([
      ['docx', true], ['docx', false], ['xlsx', false], ['xlsx', true],
    ]);
    expect(screen.getByText('履歴書プレビュー')).toBeInTheDocument();
    expect(screen.getByText('PDFではA3横 1ページとして出力します。')).toBeInTheDocument();
    rerender(
      <PreviewPanel
        previewScale="fit" setPreviewScale={setPreviewScale} showPageTabs={false}
        activePreviewPage="resume" setPreviewPage={setPreviewPage}
        resumePaperFormatLabel="A3横" activePreviewFormat="A3横" previewA4PageCount={1}
        showAccommodationButtons={false} isGeneratingPdf={false} isGeneratingOffice={false}
        isPdfOutputBlocked={false} pdfOutputBlockReason=""
        onOpenPreviewDialog={onOpenPreviewDialog} runPdfAction={runPdfAction}
        runOfficeAction={runOfficeAction} previewPaperClass="preview-paper-a3-landscape"
        previewPagesRef={{ current: null }} previewFrameHeight={420}
        resumePreview={<div>履歴書プレビュー</div>} accommodationPreview={null}
      />,
    );
    expect(screen.queryByRole('radio', { name: '履歴書と配慮事項' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '履歴書Excelを保存' }));
    expect(runOfficeAction).toHaveBeenLastCalledWith('xlsx', false);
  });

  it('renders the fallback page description without accommodation actions', () => {
    render(
      <PreviewPanel
        previewScale="large"
        setPreviewScale={vi.fn()}
        showPageTabs={false}
        activePreviewPage="accommodation"
        setPreviewPage={vi.fn()}
        resumePaperFormatLabel="A4縦"
        activePreviewFormat="A4縦"
        previewA4PageCount={null}
        showAccommodationButtons={false}
        isGeneratingPdf
        isGeneratingOffice={false}
        isPdfOutputBlocked={false}
        pdfOutputBlockReason=""
        onOpenPreviewDialog={vi.fn()}
        runPdfAction={vi.fn()}
        runOfficeAction={vi.fn()}
        previewPaperClass="preview-paper-a4-portrait"
        previewPagesRef={{ current: null }}
        previewFrameHeight={null}
        resumePreview={<div>履歴書プレビュー</div>}
        accommodationPreview={<div>配慮事項プレビュー</div>}
      />,
    );

    expect(screen.getByText('配慮事項プレビュー')).toBeInTheDocument();
    expect(screen.getByText('PDFでは入力内容を意味単位でA4縦ページへ分割します。')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '履歴書と配慮事項' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '履歴書PDFを表示' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('blocks every PDF output action with an accessible reason', () => {
    render(
      <PreviewPanel
        previewScale="fit"
        setPreviewScale={vi.fn()}
        showPageTabs
        activePreviewPage="resume"
        setPreviewPage={vi.fn()}
        resumePaperFormatLabel="A4縦"
        activePreviewFormat="A4縦"
        previewA4PageCount={2}
        showAccommodationButtons
        isGeneratingPdf={false}
        isGeneratingOffice={false}
        isPdfOutputBlocked
        pdfOutputBlockReason="A4縦2ページに収まりません。"
        onOpenPreviewDialog={vi.fn()}
        runPdfAction={vi.fn()}
        runOfficeAction={vi.fn()}
        previewPaperClass="preview-paper-a4-portrait"
        previewPagesRef={{ current: null }}
        previewFrameHeight={null}
        resumePreview={<div>履歴書プレビュー</div>}
        accommodationPreview={<div>配慮事項プレビュー</div>}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('A4縦2ページに収まりません。');
    expect(screen.getByRole('button', { name: '履歴書PDFを表示' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: '履歴書PDFを保存' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Word（.docx）' }));
    expect(screen.getByRole('button', { name: '履歴書Wordを保存' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});
