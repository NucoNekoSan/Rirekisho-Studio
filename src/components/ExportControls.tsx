import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { OfficeFormat } from '../browser/officeRenderer';

const formats = [
  { value: 'pdf', label: 'PDF', extension: '.pdf', purpose: '提出・印刷' },
  { value: 'docx', label: 'Word', extension: '.docx', purpose: '文章を編集' },
  { value: 'xlsx', label: 'Excel', extension: '.xlsx', purpose: '表を編集' },
] as const;

export function ExportControls({ paperFormatLabel, showAccommodation, busy, isPdfOutputBlocked,
  pdfOutputBlockReason, runPdfAction, runOfficeAction }: {
  paperFormatLabel: string;
  showAccommodation: boolean;
  busy: boolean;
  isPdfOutputBlocked: boolean;
  pdfOutputBlockReason: string;
  runPdfAction: (mode: 'open' | 'download', includeAccommodation: boolean) => void;
  runOfficeAction: (format: OfficeFormat, includeAccommodation: boolean) => void;
}) {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | OfficeFormat>('pdf');
  const [includeAccommodation, setIncludeAccommodation] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const headingId = useId();
  const reasonId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const nativePopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
  const format = formats.find((item) => item.value === selectedFormat)!;
  const includeSelected = showAccommodation && includeAccommodation;
  const subject = includeSelected ? '履歴書と配慮事項' : '履歴書';
  const blocked = busy || (selectedFormat === 'pdf' && isPdfOutputBlocked);

  useEffect(() => {
    if (!showAccommodation) setIncludeAccommodation(false);
  }, [showAccommodation]);

  const closeMenu = useCallback((restoreFocus = false) => {
    if (nativePopover && menuRef.current?.matches(':popover-open')) menuRef.current.hidePopover();
    setMenuOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, [nativePopover]);

  const positionMenu = useCallback(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!nativePopover || !menu || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(272, window.innerWidth - 24);
    menu.style.width = `${width}px`;
    const height = menu.offsetHeight;
    menu.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`;
    menu.style.top = `${Math.max(12, rect.bottom + height + 8 <= window.innerHeight - 12 ? rect.bottom + 8 : rect.top - height - 8)}px`;
  }, [nativePopover]);

  useEffect(() => {
    if (!menuOpen) return;
    const menu = menuRef.current;
    menu?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu?.contains(target) && !triggerRef.current?.contains(target)) closeMenu();
    };
    const leaveMenu = (event: FocusEvent) => {
      if (!menu?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', leaveMenu);
    window.addEventListener('resize', positionMenu);
    if (nativePopover) window.addEventListener('scroll', positionMenu, true);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', leaveMenu);
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [menuOpen, nativePopover, closeMenu, positionMenu]);

  useEffect(() => {
    if (busy) closeMenu();
  }, [busy, closeMenu]);

  const toggleMenu = () => {
    if (menuOpen) { closeMenu(true); return; }
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (nativePopover && menu && trigger) {
      menu.showPopover();
      positionMenu();
    }
    setMenuOpen(true);
  };

  const save = () => {
    if (blocked) return;
    if (selectedFormat === 'pdf') runPdfAction('download', includeSelected);
    else runOfficeAction(selectedFormat, includeSelected);
  };

  return (
    <section className="export-panel" aria-labelledby={headingId} aria-busy={busy}>
      <div className="export-heading">
        <h3 id={headingId}>書き出し</h3>
        <span className="export-summary">{subject} · {paperFormatLabel}</span>
      </div>
      {showAccommodation ? (
        <label className="export-supplement">
          <input type="checkbox" name="export-accommodation" checked={includeSelected} disabled={busy}
            onChange={(event) => setIncludeAccommodation(event.target.checked)} />
          配慮事項も含める
        </label>
      ) : null}
      <div className="export-split-button">
        <button type="button" className="export-save" onClick={save} aria-disabled={blocked}
          aria-label={busy ? `${subject}${format.label}を保存中` : `${subject}${format.label}を保存`}
          aria-describedby={selectedFormat === 'pdf' && isPdfOutputBlocked ? reasonId : undefined}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
          <span>{busy ? '保存中…' : `${format.label}を保存`}</span>
        </button>
        <button type="button" className="export-format-trigger" ref={triggerRef} onClick={toggleMenu}
          disabled={busy} aria-label={`保存形式を変更（現在${format.label}）`} aria-expanded={menuOpen} aria-controls={menuId}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </button>
      </div>
      <div id={menuId} ref={menuRef} className="export-format-menu" popover={nativePopover ? 'auto' : undefined}
        hidden={!nativePopover && !menuOpen}
        onToggle={(event) => setMenuOpen((event.nativeEvent as ToggleEvent).newState === 'open')}>
        <fieldset disabled={busy}>
          <legend>保存形式</legend>
          {formats.map((item) => (
            <label className="export-format-option" key={item.value}>
              <input type="radio" name={`export-format-${menuId}`} value={item.value}
                aria-label={`${item.label}（${item.extension}）`} checked={selectedFormat === item.value}
                onChange={() => setSelectedFormat(item.value)}
                onClick={() => { setSelectedFormat(item.value); closeMenu(true); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); closeMenu(true); }
                  else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const index = formats.findIndex((entry) => entry.value === item.value);
                    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? formats.length - 1
                      : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + formats.length) % formats.length;
                    setSelectedFormat(formats[nextIndex].value);
                    menuRef.current?.querySelectorAll<HTMLInputElement>('input')[nextIndex]?.focus({ preventScroll: true });
                  }
                }} />
              <span className="export-format-mark" aria-hidden="true">{item.value === 'pdf' ? 'PDF' : item.value === 'docx' ? 'W' : 'X'}</span>
              <span className="export-format-copy"><strong>{item.label}<small>{item.extension}</small></strong><span>{item.purpose}</span></span>
              <span className="export-format-check" aria-hidden="true">✓</span>
            </label>
          ))}
        </fieldset>
      </div>
      {selectedFormat === 'pdf' ? (
        <button type="button" className="export-preview-link" aria-label={`${subject}PDFを表示`} aria-disabled={blocked}
          aria-describedby={isPdfOutputBlocked ? reasonId : undefined}
          onClick={() => { if (!blocked) runPdfAction('open', includeSelected); }}>PDFを別タブで確認 <span aria-hidden="true">↗</span></button>
      ) : <p className="export-help">保存後に印刷プレビューで配置を確認してください。</p>}
      {selectedFormat === 'pdf' && isPdfOutputBlocked ? <p className="warning-text export-warning" id={reasonId} role="alert">{pdfOutputBlockReason}</p> : null}
    </section>
  );
}
