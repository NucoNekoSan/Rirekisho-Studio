import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createDefaultState } from './lib/defaults';
import { serializeProjectFile } from './lib/projectFile';

const stubPostalLookup = (address3 = '新宿') => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 200,
      message: null,
      results: [{ address1: '東京都', address2: '新宿区', address3 }],
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('App accessibility labels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('provides a skip link to the main workspace', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: '入力フォームへスキップ' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('provides western and Japanese era date display choices', () => {
    render(<App />);

    const basicSection = screen.getByRole('heading', { name: '基本情報' }).closest('section');
    expect(basicSection).not.toBeNull();

    expect(screen.getByRole('textbox', { name: '年齢' })).toBeInTheDocument();
    expect(within(basicSection as HTMLElement).getByRole('button', { name: '書式設定を表示' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: '氏名の文字揃え' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '西暦' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '和暦' })).toBeInTheDocument();
  });

  it('automatically calculates age from birth date and makes the age field read-only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 27));

    try {
      render(<App />);

      const birthDateInput = screen.getByLabelText('生年月日');
      const ageInput = screen.getByRole('textbox', { name: '年齢' });

      expect(ageInput).toHaveAttribute('readonly');
      expect(screen.getByText('生年月日から自動計算します。')).toBeInTheDocument();

      fireEvent.change(birthDateInput, { target: { value: '1999-05-12' } });

      expect(ageInput).toHaveValue('27歳');

      fireEvent.change(birthDateInput, { target: { value: '' } });

      expect(ageInput).toHaveValue('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses contact-friendly input types and mobile keyboard hints', () => {
    render(<App />);

    expect(screen.getByLabelText('郵便番号')).toHaveAttribute('autocomplete', 'postal-code');
    expect(screen.getByLabelText('郵便番号')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('郵便番号')).toHaveAttribute('placeholder', '1600022');
    expect(screen.getByLabelText('電話番号')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('電話番号')).toHaveAttribute('autocomplete', 'tel');
    expect(screen.getByLabelText('電話番号')).toHaveAttribute('inputmode', 'tel');
    expect(screen.getByLabelText('電話番号')).toHaveAttribute('placeholder', '09012345678');
    expect(screen.getByLabelText('メールアドレス')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('メールアドレス')).toHaveAttribute('inputmode', 'email');
    expect(screen.getByLabelText('メールアドレス')).toHaveAttribute('placeholder', 'taro.yamada@example.com');
    expect(screen.getByLabelText('連絡先郵便番号')).toHaveAttribute('autocomplete', 'postal-code');
    expect(screen.getByLabelText('連絡先電話番号')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('現住所')).toHaveAttribute('placeholder', '東京都新宿区新宿1-2-3 サンプルハイツ101');
    expect(screen.getByLabelText('志望動機')).toHaveAttribute('placeholder', '応募先で働きたい理由や活かせる経験');
  });

  it('connects persistent input guidance to form controls', () => {
    const { container } = render(<App />);

    expect(container.querySelector('.field-hint-placeholder')).not.toBeInTheDocument();

    const age = screen.getByRole('textbox', { name: '年齢' });
    const ageHint = screen.getByText('生年月日から自動計算します。');
    expect(ageHint).toHaveAttribute('id');
    expect(ageHint).toHaveClass('field-hint');
    expect(age.getAttribute('aria-describedby')).toContain(ageHint.id);
    expect(screen.getByText('年齢は生年月日から自動計算されます。年齢欄への直接入力は不要です。')).toBeInTheDocument();

    const name = screen.getByLabelText('氏名');
    expect(name).not.toHaveAttribute('aria-describedby');

    const postalCode = screen.getByLabelText('郵便番号');
    const postalGuidance = screen.getAllByText('7桁の数字で入力できます。ハイフンは入力後に自動で入ります。')[0].closest('.field-guidance') as HTMLElement;
    expect(postalGuidance).toHaveAttribute('id');
    expect(postalCode.getAttribute('aria-describedby')).toContain(postalGuidance.id);

    const motivation = screen.getByLabelText('志望動機');
    const motivationGuidance = screen.getByText('書き出しファイルに含まれる欄です。応募先に見せる内容だけを書きます。').closest('.field-guidance') as HTMLElement;
    expect(motivationGuidance).toHaveAttribute('id');
    expect(motivation.getAttribute('aria-describedby')).toContain(motivationGuidance.id);

    expect(screen.getByLabelText('基本情報の入力の注意')).toBeInTheDocument();
    expect(screen.getByText('作業メモは書き出しファイルに含まれません。下書きや面接前の確認に使えます。')).toBeInTheDocument();
  });

  it('limits motivation and self PR to 350 characters with accessible counters', () => {
    render(<App />);

    const motivation = screen.getByLabelText('志望動機');
    const selfPr = screen.getByLabelText('自己PR');
    const requests = screen.getByLabelText('本人希望欄');
    const overLimitText = 'あ'.repeat(351);

    expect(motivation).toHaveAttribute('maxlength', '350');
    expect(selfPr).toHaveAttribute('maxlength', '350');
    expect(requests).not.toHaveAttribute('maxlength');
    expect(screen.getAllByText('0 / 350文字')).toHaveLength(2);

    fireEvent.change(motivation, { target: { value: overLimitText } });

    expect(motivation).toHaveValue('あ'.repeat(350));
    expect(screen.getByText('350 / 350文字')).toHaveAttribute('id');
    expect(motivation.getAttribute('aria-describedby')).toContain(
      screen.getByText('350 / 350文字').id,
    );
  });

  it('opens a large editor for long text and reflects edits immediately', async () => {
    render(<App />);

    const motivation = screen.getByLabelText('志望動機');
    expect(screen.getByRole('button', { name: '志望動機を大きく編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '自己PRを大きく編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '作業メモを大きく編集' })).toBeInTheDocument();

    fireEvent.click(motivation);

    const dialog = await screen.findByRole('dialog', { name: '志望動機を大きく編集' });
    const expandedEditor = within(dialog).getByRole('textbox', { name: '志望動機' });
    expect(expandedEditor).toHaveAttribute('maxlength', '350');

    fireEvent.change(expandedEditor, { target: { value: '文章全体を確認しながら編集' } });

    expect(motivation).toHaveValue('文章全体を確認しながら編集');
    expect(within(dialog).getByText('13 / 350文字')).toBeInTheDocument();
  });

  it('keeps legacy over-limit text, blocks PDF output, and allows reducing it to the limit', async () => {
    const state = createDefaultState();
    state.resume.selfPr = '自'.repeat(432);
    const projectText = serializeProjectFile(state, false);
    const file = new File([projectText], 'legacy-over-limit.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue(projectText) });

    render(<App />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('入力データを読込'), {
        target: { files: [file] },
      });
    });

    const selfPr = screen.getByLabelText('自己PR');
    expect(selfPr).toHaveValue('自'.repeat(432));
    expect(selfPr).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('432 / 350文字')).toHaveClass('over-limit');
    expect(screen.getAllByText(/自己PRは350文字以内にしてください（現在432文字）/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '履歴書PDFを表示' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: '履歴書PDFを保存' })).toHaveAttribute('aria-disabled', 'true');

    fireEvent.change(selfPr, { target: { value: '自'.repeat(431) } });
    expect(selfPr).toHaveValue('自'.repeat(431));

    fireEvent.change(selfPr, { target: { value: '自'.repeat(432) } });
    expect(selfPr).toHaveValue('自'.repeat(431));

    fireEvent.change(selfPr, { target: { value: '自'.repeat(350) } });
    expect(selfPr).toHaveValue('自'.repeat(350));
    expect(selfPr).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/自己PRは350文字以内にしてください/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '履歴書PDFを表示' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '履歴書PDFを保存' })).toBeEnabled();
  });

  it('formats postal code and phone number fields after blur', () => {
    vi.useFakeTimers();
    render(<App />);

    const postalCode = screen.getByLabelText('郵便番号');
    const phone = screen.getByLabelText('電話番号');
    const contactPostalCode = screen.getByLabelText('連絡先郵便番号');
    const contactPhone = screen.getByLabelText('連絡先電話番号');

    fireEvent.change(postalCode, { target: { value: '1600022' } });
    fireEvent.blur(postalCode);
    fireEvent.change(phone, { target: { value: '09012345678' } });
    fireEvent.blur(phone);
    fireEvent.change(contactPostalCode, { target: { value: '１６０００２２' } });
    fireEvent.blur(contactPostalCode);
    fireEvent.change(contactPhone, { target: { value: '0312345678' } });
    fireEvent.blur(contactPhone);

    expect(postalCode).toHaveValue('160-0022');
    expect(phone).toHaveValue('090-1234-5678');
    expect(contactPostalCode).toHaveValue('160-0022');
    expect(contactPhone).toHaveValue('03-1234-5678');
  });

  it('shows accessible format errors after invalid input blur and clears them after correction', () => {
    vi.useFakeTimers();
    render(<App />);

    const postalCode = screen.getByLabelText('郵便番号');
    const phone = screen.getByLabelText('電話番号');
    const email = screen.getByLabelText('メールアドレス');

    fireEvent.change(postalCode, { target: { value: '123' } });
    fireEvent.blur(postalCode);
    fireEvent.change(phone, { target: { value: '09012' } });
    fireEvent.blur(phone);
    fireEvent.change(email, { target: { value: 'invalid@example' } });
    fireEvent.blur(email);

    expect(screen.getByText('郵便番号は数字7桁で入力してください。')).toBeInTheDocument();
    expect(screen.getByText('電話番号は数字10桁または11桁で入力してください。')).toBeInTheDocument();
    expect(screen.getByText('メールアドレスの形式を確認してください。')).toBeInTheDocument();
    expect(postalCode).toHaveAttribute('aria-invalid', 'true');
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(postalCode, { target: { value: '1600022' } });
    fireEvent.blur(postalCode);
    fireEvent.change(phone, { target: { value: '09012345678' } });
    fireEvent.blur(phone);
    fireEvent.change(email, { target: { value: 'taro.yamada@example.com' } });
    fireEvent.blur(email);

    expect(screen.queryByText('郵便番号は数字7桁で入力してください。')).not.toBeInTheDocument();
    expect(screen.queryByText('電話番号は数字10桁または11桁で入力してください。')).not.toBeInTheDocument();
    expect(screen.queryByText('メールアドレスの形式を確認してください。')).not.toBeInTheDocument();
    expect(postalCode).not.toHaveAttribute('aria-invalid');
    expect(phone).not.toHaveAttribute('aria-invalid');
    expect(email).not.toHaveAttribute('aria-invalid');
  });

  it('autofills the current address when postal code lookup succeeds and the address is blank', async () => {
    vi.useFakeTimers();
    stubPostalLookup();
    render(<App />);

    fireEvent.change(screen.getByLabelText('郵便番号'), { target: { value: '160-0022' } });

    expect(screen.getByText('住所を検索しています。')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByLabelText('現住所')).toHaveValue('東京都新宿区新宿');
    expect(screen.getByText('住所を自動入力しました。番地・建物名を確認してください。')).toBeInTheDocument();
    expect(screen.getByText('郵便番号のみを住所検索APIへ送信します。')).toBeInTheDocument();
  });

  it('shows an address candidate instead of overwriting an existing current address', async () => {
    vi.useFakeTimers();
    stubPostalLookup();
    render(<App />);

    fireEvent.change(screen.getByLabelText('現住所'), { target: { value: '入力済み住所' } });
    fireEvent.change(screen.getByLabelText('郵便番号'), { target: { value: '1600022' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText('取得住所: 東京都新宿区新宿')).toBeInTheDocument();
    expect(screen.getByLabelText('現住所')).toHaveValue('入力済み住所');

    fireEvent.click(screen.getByRole('button', { name: '現住所に反映' }));

    expect(screen.getByLabelText('現住所')).toHaveValue('東京都新宿区新宿');
  });

  it('autofills the contact address independently from contact postal code', async () => {
    vi.useFakeTimers();
    stubPostalLookup('西新宿');
    render(<App />);

    fireEvent.change(screen.getByLabelText('連絡先郵便番号'), { target: { value: '160-0023' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByLabelText('連絡先住所')).toHaveValue('東京都新宿区西新宿');
    expect(screen.getByLabelText('現住所')).toHaveValue('');
  });

  it('lets users choose text alignment with buttons', () => {
    render(<App />);

    const basicSection = screen.getByRole('heading', { name: '基本情報' }).closest('section');
    expect(basicSection).not.toBeNull();
    fireEvent.click(within(basicSection as HTMLElement).getByRole('button', { name: '書式設定を表示' }));

    const nameInput = screen.getByRole('textbox', { name: '氏名' });
    const nameAlignment = screen.getByRole('group', { name: '氏名の文字揃え' });

    fireEvent.click(within(nameAlignment).getByRole('button', { name: '中央' }));

    expect(within(nameAlignment).getByRole('button', { name: '中央' })).toHaveAttribute('aria-pressed', 'true');
    expect(nameInput).toHaveStyle({ textAlign: 'center' });
  });

  it('uses the normal input workflow only', () => {
    render(<App />);

    expect(screen.queryByRole('group', { name: '入力モード' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'かんたん入力' })).not.toBeInTheDocument();

    const basicSection = screen.getByRole('heading', { name: '基本情報' }).closest('section');
    expect(basicSection).not.toBeNull();
    expect(within(basicSection as HTMLElement).getByRole('button', { name: '書式設定を表示' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '氏名の文字揃え' })).not.toBeInTheDocument();
  });

  it('hides sensitive accommodation inputs for general applications', () => {
    render(<App />);

    expect(screen.getByText('配慮事項シートは無効です')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '配慮事項シートを有効にする' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '障害名・診断名' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '通院状況' })).not.toBeInTheDocument();
  });

  it('keeps section completion status incomplete until required fields are actually filled', () => {
    render(<App />);

    const navigation = screen.getByRole('navigation', { name: '入力セクション' });
    const basicButton = within(navigation).getByRole('button', { name: /基本情報/ });
    const historyButton = within(navigation).getByRole('button', { name: /学歴・職歴/ });

    expect(within(basicButton).getByText('未入力あり')).toBeInTheDocument();
    expect(within(historyButton).getByText('未入力あり')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('氏名'), { target: { value: '山田 太郎' } });
    fireEvent.change(screen.getByLabelText('ふりがな'), { target: { value: 'やまだ たろう' } });
    fireEvent.change(screen.getByLabelText('生年月日'), { target: { value: '1999-05-12' } });
    fireEvent.change(screen.getByLabelText('現住所'), { target: { value: '東京都新宿区1-2-3' } });
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'taro@example.com' } });
    fireEvent.change(screen.getByLabelText('学歴・職歴1行目の年'), { target: { value: '2018' } });
    fireEvent.change(screen.getByLabelText('学歴・職歴1行目の月'), { target: { value: '4' } });

    expect(within(basicButton).getByText('入力済み')).toBeInTheDocument();
    expect(within(historyButton).getByText('入力済み')).toBeInTheDocument();
  });

  it('provides PDF preview scale controls and a clear confirmation dialog', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: '全体表示' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '拡大表示' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '見本を大きく見る' })).toBeInTheDocument();
    const dialogs = screen.getAllByRole('dialog', { hidden: true });
    expect(dialogs.find((dialog) => dialog.getAttribute('aria-labelledby') === 'preview-dialog-title')).toBeInTheDocument();
    expect(dialogs.find((dialog) => dialog.getAttribute('aria-labelledby') === 'clear-dialog-title')).toBeInTheDocument();
    expect(screen.getByText('入力内容をすべて消去しますか')).toHaveAttribute('id', 'clear-dialog-title');
  });

  it('provides page switching controls for disability application previews', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('checkbox', { name: '配慮事項シートを作成する' }));

    expect(screen.getByRole('button', { name: '履歴書（A4縦）' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '配慮事項シート（A4縦）' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '配慮事項シート（A4縦）' }));

    expect(screen.getByRole('button', { name: '履歴書（A4縦）' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '配慮事項シート（A4縦）' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows A4 portrait accommodation output controls in disability applications', () => {
    render(<App />);

    expect(screen.getByText('履歴書はA4縦形式で出力します。')).toBeInTheDocument();
    expect(screen.getByText('作業メモは書き出しファイルに含めません。')).toBeInTheDocument();
    expect(screen.getByText('追加書類が無効のため、配慮事項シートは出力しません。')).toBeInTheDocument();
    expect(screen.queryByText('配慮事項シートはA4縦形式で出力します。')).not.toBeInTheDocument();
    expect(screen.getByText('右側の仕上がり見本を確認し、保存形式と内容を選んで書き出します。Word・Excelは保存後に印刷プレビューでページ配置を確認してください。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /保存形式を変更/ }));
    expect(screen.getByRole('radio', { name: 'PDF（.pdf）' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /保存形式を変更/ }));
    expect(screen.getByRole('button', { name: '履歴書PDFを保存' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '配慮事項も含める' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: '配慮事項シートを作成する' }));
    expect(screen.getByText('配慮事項シートはA4縦形式で出力します。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '配慮事項も含める' }));
    expect(screen.getByRole('button', { name: '履歴書と配慮事項PDFを保存' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /保存形式を変更/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Word（.docx）' }));
    expect(screen.getByRole('button', { name: '履歴書と配慮事項Wordを保存' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '履歴書と配慮事項PDFを表示' })).not.toBeInTheDocument();
  });

  it('lets users choose the PDF font family for preview and export', () => {
    const { container } = render(<App />);

    const gothic = screen.getByRole('radio', { name: 'ゴシック（読みやすい）' });
    const mincho = screen.getByRole('radio', { name: '明朝（フォーマル）' });
    const previewDocument = container.querySelector('.preview-panel .resume-document');
    const exportDocument = container.querySelector('.pdf-export-root .resume-document');

    expect(mincho).toBeChecked();
    expect(previewDocument).toHaveClass('pdf-font-mincho');
    expect(exportDocument).toHaveClass('pdf-font-mincho');

    fireEvent.click(gothic);

    expect(gothic).toBeChecked();
    expect(previewDocument).toHaveClass('pdf-font-gothic');
    expect(exportDocument).toHaveClass('pdf-font-gothic');
  });

  it('lets users choose the PDF paper format for preview and export', () => {
    const { container } = render(<App />);

    const a4 = screen.getByRole('radio', { name: 'A4縦（標準）' });
    const a3 = screen.getByRole('radio', { name: 'A3横（1枚）' });

    expect(a4).toBeChecked();
    expect(screen.getByText('履歴書はA4縦形式で出力します。')).toBeInTheDocument();
    expect(container.querySelector('.preview-panel .resume-page')).toBeInTheDocument();
    expect(container.querySelector('.preview-panel .resume-a3-page')).not.toBeInTheDocument();

    fireEvent.click(a3);

    expect(a3).toBeChecked();
    expect(screen.getByText('履歴書はA3横形式で出力します。')).toBeInTheDocument();
    expect(screen.getByText('A3横は履歴書を1枚にまとめる形式です。')).toBeInTheDocument();
    expect(screen.getByText('履歴書をA3横1枚で出力します。配慮事項シートを有効にした場合はA4縦の別紙です。')).toBeInTheDocument();
    expect(container.querySelector('.preview-panel .resume-a3-document')).toBeInTheDocument();
    expect(container.querySelector('.preview-panel .resume-a3-page')).toBeInTheDocument();
    expect(container.querySelector('.pdf-export-root .resume-a3-page')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: '配慮事項シートを作成する' }));

    expect(screen.getByRole('button', { name: '履歴書（A3横）' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '配慮事項シート（A4縦）' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('配慮事項シートはA4縦形式で出力します。')).toBeInTheDocument();
  });

  it('fills a disability-employment A3 demo for print checking', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'A3横・配慮事項付きデモを入力' }));

    expect(screen.getByLabelText('氏名')).toHaveValue('佐藤 花子');
    expect(screen.getByLabelText('ふりがな')).toHaveValue('さとう はなこ');
    expect(screen.getByRole('checkbox', { name: '配慮事項シートを作成する' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A3横（1枚）' })).toBeChecked();
    expect(screen.getByText('A3横・配慮事項付きデモを入力しました。右側の仕上がり見本で確認できます。')).toBeInTheDocument();
    expect((screen.getByLabelText('志望動機') as HTMLTextAreaElement).value).toHaveLength(350);
    expect((screen.getByLabelText('自己PR') as HTMLTextAreaElement).value).toHaveLength(350);
    expect(screen.getByLabelText('学歴・職歴18行目の内容')).toHaveValue('以上');
    expect(screen.getByDisplayValue('自閉スペクトラム症（ASD）')).toBeInTheDocument();
    expect(screen.getByText('配慮事項シートの出力項目: 10件')).toBeInTheDocument();
    expect(screen.getByText('配慮事項シートに機微情報が含まれます。')).toBeInTheDocument();
    expect(container.querySelector('.preview-panel .resume-a3-page')).toBeInTheDocument();
    expect(container.querySelector('.pdf-export-root .resume-a3-page')).toBeInTheDocument();
  });

  it('blocks A4 PDF output when the content exceeds the fixed two-page capacity', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('志望動機'), { target: { value: '応\n'.repeat(150) } });

    expect(screen.getByRole('alert')).toHaveTextContent('A4縦2ページに収まらないため、PDFを表示・保存できません');
    expect(screen.getByRole('button', { name: '履歴書PDFを表示' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: '履歴書PDFを保存' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('uses input data wording for local save and load actions', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '入力データ保存' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '入力データを保存' })).toBeInTheDocument();
    expect(screen.getByText('入力データを読込')).toBeInTheDocument();
    expect(screen.getByText('追加書類が無効の場合、配慮事項の入力内容はJSONファイルに含めません。')).toBeInTheDocument();
    expect(screen.getByText('既定では写真を入力データに含めません。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存ファイルを作成' })).not.toBeInTheDocument();
    expect(screen.queryByText('保存ファイルを読込')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: '配慮事項シートを作成する' }));

    expect(screen.getByText('配慮事項シートを有効にしているため、その入力内容もJSONファイルに含まれます。')).toBeInTheDocument();
  });

  it('does not show temporary sample input controls in the output area', () => {
    render(<App />);

    expect(screen.queryByRole('heading', { name: 'サンプル入力' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '一般応募サンプルを入力' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '職歴多めサンプルを入力' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A3横・配慮事項付きデモを入力' })).toBeInTheDocument();
  });

  it('disambiguates repeated editable row controls', () => {
    render(<App />);

    expect(screen.getByLabelText('学歴・職歴1行目の年')).toBeInTheDocument();
    expect(screen.getByLabelText('学歴・職歴1行目の月')).toBeInTheDocument();
    expect(screen.getByLabelText('学歴・職歴1行目の内容')).toBeInTheDocument();
    expect(screen.getByLabelText('免許・資格1行目の内容')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '学歴・職歴1行目を上へ移動' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '免許・資格1行目を下へ移動' })).toBeDisabled();
  });

  it('uses unique hint ids for described text areas', () => {
    const { container } = render(<App />);
    const hintIds = Array.from(container.querySelectorAll<HTMLElement>('[id$="-hint"]')).map((element) => element.id);

    expect(hintIds.length).toBeGreaterThan(0);
    expect(new Set(hintIds).size).toBe(hintIds.length);
  });
});
