import { useEffect, useRef } from 'react';
import { tutorialSteps } from '../lib/tutorialSteps';

export function InputTutorial({ index, onPrevious, onNext, onClose }: {
  index: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const step = tutorialSteps[index];

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
      <p className="input-tutorial-progress">チュートリアル {index + 1} / {tutorialSteps.length}</p>
      <h2 id="tutorial-step-title" ref={titleRef} tabIndex={-1}>{step.title}</h2>
      <p>{step.description}</p>
      <p className="input-tutorial-note">この案内は入力内容を変更しません。いつでも終了できます。</p>
      <div className="input-tutorial-actions">
        <button type="button" className="secondary compact-button" onClick={focusTarget}>操作箇所へ移動</button>
        <button type="button" className="secondary compact-button" onClick={onPrevious} disabled={index === 0}>前へ</button>
        <button type="button" className="compact-button" onClick={index === tutorialSteps.length - 1 ? onClose : onNext}>
          {index === tutorialSteps.length - 1 ? '完了' : '次へ'}
        </button>
        <button type="button" className="secondary compact-button" onClick={onClose}>終了</button>
      </div>
    </section>
  );
}
