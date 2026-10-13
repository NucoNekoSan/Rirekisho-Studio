import { useEffect, useRef } from 'react';
import type { TutorialStep } from '../lib/tutorialSteps';

export function InputTutorial({ index, steps, onPrevious, onNext, onClose }: {
  index: number;
  steps: readonly TutorialStep[];
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const step = steps[index];

  useEffect(() => {
    titleRef.current?.scrollIntoView?.({ block: 'start' });
    titleRef.current?.focus();
  }, [index]);

  const focusTarget = () => {
    const target = document.getElementById(step.target);
    const selector = step.target === 'preview-panel' ? '.preview-toolbar button' : 'input, textarea, select, button';
    const field = target?.querySelector<HTMLElement>(selector);
    field?.focus();
  };

  return (
    <section className="input-tutorial" id="input-tutorial" aria-labelledby="tutorial-step-title">
      <p className="input-tutorial-progress">操作デモ {index + 1} / {steps.length}</p>
      <h2 id="tutorial-step-title" ref={titleRef} tabIndex={-1}>{step.title}</h2>
      <p>{step.description}</p>
      <p className="input-tutorial-note">操作は自由です。練習内容は端末内の履歴書に保存されません。いつでも終了できます。</p>
      <div className="input-tutorial-actions">
        <button type="button" className="secondary compact-button" onClick={focusTarget}>操作箇所へ移動</button>
        <button type="button" className="secondary compact-button" onClick={onPrevious} disabled={index === 0}>前へ</button>
        <button type="button" className="compact-button" onClick={index === steps.length - 1 ? onClose : onNext}>
          {index === steps.length - 1 ? '完了' : '次へ'}
        </button>
        <button type="button" className="secondary compact-button" onClick={onClose}>終了</button>
      </div>
    </section>
  );
}
