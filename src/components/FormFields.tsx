import { useId, useRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { TextAlignment } from '../lib/types';
import type { SectionStatus } from '../lib/sectionStatus';
import { applyTextLengthLimit } from '../lib/textInput';

type GuidanceText = string | string[];

const alignmentOptions: Array<{ value: TextAlignment; label: string }> = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中央' },
  { value: 'right', label: '右' },
];

export function FormSection({
  id,
  title,
  description,
  guidance,
  status,
  formattingVisible,
  onToggleFormatting,
  children,
}: {
  id: string;
  title: string;
  description: string;
  guidance?: GuidanceText;
  status?: SectionStatus;
  formattingVisible?: boolean;
  onToggleFormatting?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="form-section" id={id}>
      <header>
        <div className="form-section-title-row">
          <h2>{title}</h2>
          <div className="form-section-actions">
            {status ? <span className={`section-state ${status === '入力済み' ? 'complete' : status === '未入力あり' ? 'warning' : 'neutral'}`}>{status}</span> : null}
            {onToggleFormatting ? (
              <button type="button" className="secondary compact-button" aria-expanded={formattingVisible} onClick={onToggleFormatting}>
                {formattingVisible ? '書式設定を隠す' : '書式設定を表示'}
              </button>
            ) : null}
          </div>
        </div>
        <p>{description}</p>
      </header>
      {guidance ? <SectionGuidance title={title} guidance={guidance} /> : null}
      {children}
    </section>
  );
}

function SectionGuidance({ title, guidance }: { title: string; guidance: GuidanceText }) {
  const items = Array.isArray(guidance) ? guidance : [guidance];
  return (
    <div className="section-guidance" aria-label={`${title}の入力の注意`}>
      <strong>入力の注意</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function FieldGuidance({ id, guidance }: { id: string; guidance: GuidanceText }) {
  if (Array.isArray(guidance)) {
    return (
      <ul id={id} className="field-guidance">
        {guidance.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }

  return <p id={id} className="field-guidance">{guidance}</p>;
}

export function TextAlignmentControl({
  label,
  alignment,
  onChange,
}: {
  label: string;
  alignment: TextAlignment;
  onChange: (alignment: TextAlignment) => void;
}) {
  return (
    <div className="alignment-control">
      <span>文字揃え</span>
      <div className="alignment-buttons" role="group" aria-label={`${label}の文字揃え`}>
        {alignmentOptions.map((option) => (
          <button
            type="button"
            key={option.value}
            className={alignment === option.value ? 'active' : ''}
            aria-pressed={alignment === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  autoComplete,
  inputMode,
  hint,
  guidance,
  placeholder,
  error,
  readOnly = false,
  alignment = 'left',
  onAlignmentChange,
  showAlignmentControl = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  hint?: string;
  guidance?: GuidanceText;
  placeholder?: string;
  error?: string;
  readOnly?: boolean;
  alignment?: TextAlignment;
  onAlignmentChange?: (alignment: TextAlignment) => void;
  showAlignmentControl?: boolean;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const guidanceId = `${inputId}-guidance`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : '', guidance ? guidanceId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field aligned-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-describedby={describedBy}
        aria-errormessage={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        style={{ textAlign: alignment }}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {hint ? <em id={hintId} className="field-hint">{hint}</em> : null}
      {guidance ? <FieldGuidance id={guidanceId} guidance={guidance} /> : null}
      {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
      {onAlignmentChange && showAlignmentControl ? <TextAlignmentControl label={label} alignment={alignment} onChange={onAlignmentChange} /> : null}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  hint,
  guidance,
  placeholder,
  alignment = 'left',
  onAlignmentChange,
  showAlignmentControl = false,
  maxLength,
  error,
  onExpand,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  guidance?: GuidanceText;
  placeholder?: string;
  alignment?: TextAlignment;
  onAlignmentChange?: (alignment: TextAlignment) => void;
  showAlignmentControl?: boolean;
  maxLength?: number;
  error?: string;
  onExpand?: (textarea: HTMLTextAreaElement) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaId = useId();
  const hintId = `${textareaId}-hint`;
  const guidanceId = `${textareaId}-guidance`;
  const countId = `${textareaId}-count`;
  const errorId = `${textareaId}-error`;
  const describedBy = [
    hint ? hintId : '',
    guidance ? guidanceId : '',
    maxLength ? countId : '',
    error ? errorId : '',
  ].filter(Boolean).join(' ') || undefined;

  const handleChange = (nextValue: string) => onChange(applyTextLengthLimit(value, nextValue, maxLength));

  return (
    <div className="field aligned-field">
      <label htmlFor={textareaId}>{label}</label>
      <textarea
        ref={textareaRef}
        id={textareaId}
        value={value}
        maxLength={maxLength}
        aria-describedby={describedBy}
        aria-errormessage={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        placeholder={placeholder}
        style={{ textAlign: alignment }}
        onChange={(event) => handleChange(event.target.value)}
        onClick={onExpand ? (event) => onExpand(event.currentTarget) : undefined}
        aria-haspopup={onExpand ? 'dialog' : undefined}
        rows={5}
      />
      {onExpand ? (
        <button
          type="button"
          className="secondary compact-button text-area-expand-button"
          aria-label={`${label}を大きく編集`}
          onClick={() => textareaRef.current && onExpand(textareaRef.current)}
        >
          大きく編集
        </button>
      ) : null}
      {maxLength ? (
        <span id={countId} className={`field-character-count${error ? ' over-limit' : ''}`}>
          {value.length} / {maxLength}文字
        </span>
      ) : null}
      {hint ? <em id={hintId} className="field-hint">{hint}</em> : null}
      {guidance ? <FieldGuidance id={guidanceId} guidance={guidance} /> : null}
      {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
      {onAlignmentChange && showAlignmentControl ? <TextAlignmentControl label={label} alignment={alignment} onChange={onAlignmentChange} /> : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  alignment = 'left',
  onAlignmentChange,
  showAlignmentControl = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  alignment?: TextAlignment;
  onAlignmentChange?: (alignment: TextAlignment) => void;
  showAlignmentControl?: boolean;
}) {
  const selectId = useId();
  return (
    <div className="field aligned-field">
      <label htmlFor={selectId}>{label}</label>
      <select id={selectId} value={value} style={{ textAlign: alignment }} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      {onAlignmentChange && showAlignmentControl ? <TextAlignmentControl label={label} alignment={alignment} onChange={onAlignmentChange} /> : null}
    </div>
  );
}

export function ToggleText({
  label,
  enabled,
  value,
  onToggle,
  onChange,
  placeholder,
  guidance = 'チェックをONにした項目だけ配慮事項シートに出力されます。',
  alignment,
  onAlignmentChange,
  showAlignmentControl = false,
}: {
  label: string;
  enabled: boolean;
  value: string;
  onToggle: (value: boolean) => void;
  onChange: (value: string) => void;
  placeholder?: string;
  guidance?: GuidanceText;
  alignment?: TextAlignment;
  onAlignmentChange?: (alignment: TextAlignment) => void;
  showAlignmentControl?: boolean;
}) {
  return <div className="toggle-text"><label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />{label}を出力する</label><TextArea label={label} value={value} onChange={onChange} hint="チェックがONの場合だけ配慮事項シートに出力します。" guidance={guidance} placeholder={placeholder} alignment={alignment} onAlignmentChange={onAlignmentChange} showAlignmentControl={showAlignmentControl} /></div>;
}
