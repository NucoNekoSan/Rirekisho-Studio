import type { HistoryEntry } from './types';

export type ResumePaperVariant = 'a3' | 'a4';

/** Fixed A4/A3 row counts shared by the PDF and editable exports. */
export const HISTORY_LAYOUT: Record<ResumePaperVariant, {
  primaryRows: number;
  primaryMin: number;
  secondaryMin: number;
  qualBlanks: number;
}> = {
  a3: { primaryRows: 22, primaryMin: 22, secondaryMin: 7, qualBlanks: 3 },
  a4: { primaryRows: 21, primaryMin: 21, secondaryMin: 5, qualBlanks: 5 },
};

export function splitResumeHistory(rows: HistoryEntry[], variant: ResumePaperVariant) {
  const layout = HISTORY_LAYOUT[variant];
  return {
    layout,
    primaryRows: rows.slice(0, layout.primaryRows),
    secondaryRows: rows.slice(layout.primaryRows),
  };
}
