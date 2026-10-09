import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportControls } from './ExportControls';

const setupProps = () => ({
  paperFormatLabel: 'A4縦', showAccommodation: true, busy: false,
  isPdfOutputBlocked: false, pdfOutputBlockReason: '', runPdfAction: vi.fn(), runOfficeAction: vi.fn(),
});

describe('ExportControls', () => {
  it('closes an open menu and prevents duplicate output while generating', () => {
    const props = setupProps();
    const { rerender } = render(<ExportControls {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /保存形式を変更/ }));
    expect(screen.getByRole('radio', { name: 'PDF（.pdf）' })).toBeInTheDocument();
    rerender(<ExportControls {...props} busy />);
    expect(screen.queryByRole('radio', { name: 'PDF（.pdf）' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存形式を変更/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '配慮事項も含める' })).toBeDisabled();
    const save = screen.getByRole('button', { name: '履歴書PDFを保存中' });
    expect(save).toHaveTextContent('保存中…');
    fireEvent.click(save);
    fireEvent.click(screen.getByRole('button', { name: '履歴書PDFを表示' }));
    expect(props.runPdfAction).not.toHaveBeenCalled();
  });

  it('offers a focused inline disclosure and restores focus on Escape without saving', () => {
    const props = setupProps();
    render(<ExportControls {...props} />);
    const trigger = screen.getByRole('button', { name: /保存形式を変更/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('radio', { name: 'PDF（.pdf）' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(props.runPdfAction).not.toHaveBeenCalled();
    expect(props.runOfficeAction).not.toHaveBeenCalled();
  });
});
