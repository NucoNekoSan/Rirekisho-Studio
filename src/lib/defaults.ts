// サンプルデータ定義: 初期表示やテストで使用するデフォルトの履歴書・配慮事項データ
import type { AccommodationData, AppState, ResumeData } from './types';

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** 空の履歴書データを生成（アプリ初期表示時に使用） */
export const createDefaultResume = (): ResumeData => ({
  enabledSupplements: [],
  inputMode: 'standard',
  eraMode: 'western',
  pdfFontFamily: 'mincho',
  pdfPaperFormat: 'a4-portrait',
  createdAt: now(),
  updatedAt: now(),
  basic: {
    name: '',
    furigana: '',
    birthDate: '',
    age: '',
    gender: '',
    postalCode: '',
    address: '',
    phone: '',
    email: '',
    contactPostalCode: '',
    contactAddress: '',
    contactPhone: '',
  },
  histories: [
    { id: id(), year: '', month: '', text: '学歴' },
    { id: id(), year: '', month: '', text: '高等学校 入学' },
    { id: id(), year: '', month: '', text: '高等学校 卒業' },
    { id: id(), year: '', month: '', text: '職歴' },
    { id: id(), year: '', month: '', text: '以上' },
  ],
  qualifications: [{ id: id(), year: '', month: '', text: '' }],
  commuteTime: '',
  dependents: '',
  spouse: '',
  spouseSupport: '',
  motivation: '',
  selfPr: '',
  requests: '勤務条件については貴社規定に従います。',
  memo: '',
  photo: null,
  textAlignments: {},
});

/** 空の配慮事項データを生成 */
export const createDefaultAccommodation = (): AccommodationData => ({
  includeDisabilityName: false,
  disabilityName: '',
  includeCertificate: false,
  certificate: '',
  includeHospitalVisit: false,
  hospitalVisit: '',
  includeMedication: false,
  medication: '',
  includeSupportContact: false,
  supportContact: '',
  strengths: '',
  difficultSituations: '',
  requestedAccommodations: '',
  selfCare: '',
  warningSigns: '',
  textAlignments: {},
});

export const createDefaultState = (): AppState => ({
  resume: createDefaultResume(),
  accommodation: createDefaultAccommodation(),
});

/** 標準履歴書のサンプルデータを生成（動作確認用。架空の山田太郎） */
export const createGeneralDemoState = (): AppState => {
  const resume = createDefaultResume();
  return {
    resume: {
      ...resume,
      enabledSupplements: [],
      inputMode: 'standard',
      eraMode: 'western',
      basic: {
        name: '山田 太郎',
        furigana: 'やまだ たろう',
        birthDate: '1999-05-12',
        age: '27歳',
        gender: 'male',
        postalCode: '160-0022',
        address: '東京都新宿区新宿1-2-3 サンプルハイツ101',
        phone: '090-1234-5678',
        email: 'taro.yamada@example.com',
        contactPostalCode: '',
        contactAddress: '同上',
        contactPhone: '',
      },
      histories: [
        { id: id(), year: '2018', month: '4', text: '東京都立青葉高等学校 普通科 入学' },
        { id: id(), year: '2021', month: '3', text: '東京都立青葉高等学校 普通科 卒業' },
        { id: id(), year: '2021', month: '4', text: '株式会社サンプル 入社' },
        { id: id(), year: '2024', month: '9', text: '一身上の都合により退職' },
        { id: id(), year: '2024', month: '10', text: '職業訓練校にて就職準備開始' },
        { id: id(), year: '', month: '', text: '以上' },
      ],
      qualifications: [
        { id: id(), year: '2020', month: '8', text: '普通自動車第一種運転免許 取得' },
        { id: id(), year: '2022', month: '2', text: '日本商工会議所簿記検定3級 合格' },
        { id: id(), year: '2024', month: '6', text: 'Microsoft Office Specialist Excel 365 取得' },
      ],
      commuteTime: '約45分',
      dependents: '0人',
      spouse: '無',
      spouseSupport: '無',
      motivation:
        '貴社の事務職では、正確な入力作業と周囲への確認を大切にしながら、継続して業務に取り組める点を活かしたいと考えています。前職では、日々の記録作成や資料整理を担当し、期限を守って丁寧に処理することを意識してきました。入社後は、基本的な業務を確実に覚え、チームの一員として安定して貢献したいです。',
      selfPr:
        '私の強みは、手順を確認しながら正確に作業を進められることです。分からない点をそのままにせず、早めに確認することでミスを防ぐよう心がけています。また、Excelでの表作成やデータ入力の練習を続けており、見やすい資料を作ることにも関心があります。',
      requests: '勤務条件については貴社規定に従います。',
      memo: 'これは紙出力確認用の架空サンプルです。PDFには出力されません。',
      photo: null,
    },
    accommodation: createDefaultAccommodation(),
  };
};

/** 配慮事項付きのサンプルデータを生成（350文字上限の動作確認用。架空の佐藤花子） */
export const createDisabilityEmploymentDemoState = (): AppState => {
  const state = createGeneralDemoState();
  return {
    ...state,
    resume: {
      ...state.resume,
      enabledSupplements: ['accommodation'],
      basic: {
        ...state.resume.basic,
        name: '佐藤 花子',
        furigana: 'さとう はなこ',
        birthDate: '1987-11-04',
        age: '38歳',
        gender: 'female',
        postalCode: '164-0001',
        address: '東京都中野区中野4-5-6 サンプルコート202',
        phone: '090-2345-6789',
        email: 'hanako.sato@example.com',
      },
      histories: [
        { id: id(), year: '2003', month: '4', text: '東京都立若葉高等学校 普通科 入学' },
        { id: id(), year: '2006', month: '3', text: '東京都立若葉高等学校 普通科 卒業' },
        { id: id(), year: '', month: '', text: '職歴' },
        { id: id(), year: '2006', month: '4', text: '株式会社アオバ商事 入社 販売補助として勤務' },
        { id: id(), year: '2009', month: '3', text: '一身上の都合により退職' },
        { id: id(), year: '2009', month: '4', text: '株式会社サンプル物流 入社 伝票整理・在庫確認を担当' },
        { id: id(), year: '2012', month: '6', text: '契約期間満了により退職' },
        { id: id(), year: '2012', month: '7', text: '株式会社北町オフィス 入社 一般事務として勤務' },
        { id: id(), year: '2016', month: '12', text: '一身上の都合により退職' },
        { id: id(), year: '2017', month: '1', text: '株式会社中央データサービス 入社 データ入力業務を担当' },
        { id: id(), year: '2019', month: '8', text: '契約期間満了により退職' },
        { id: id(), year: '2019', month: '9', text: '青山サポート株式会社 入社 書類整理・スキャン業務を担当' },
        { id: id(), year: '2021', month: '3', text: '体調調整のため退職' },
        { id: id(), year: '2022', month: '4', text: '職業訓練校にて就職準備開始' },
        { id: id(), year: '2023', month: '1', text: '株式会社ひかり事務センター 入社 障害者雇用で請求書確認を担当' },
        { id: id(), year: '2025', month: '12', text: '契約期間満了により退職' },
        { id: id(), year: '2026', month: '1', text: '再就職に向けた職業訓練を開始' },
        { id: id(), year: '', month: '', text: '以上' },
      ],
      qualifications: [
        { id: id(), year: '2016', month: '7', text: '日本商工会議所簿記検定3級 合格' },
        { id: id(), year: '2020', month: '11', text: 'Microsoft Office Specialist Word 365 取得' },
        { id: id(), year: '2024', month: '6', text: 'Microsoft Office Specialist Excel 365 取得' },
      ],
      commuteTime: '約50分',
      motivation:
        '私はこれまで、データ入力、伝票整理、請求書確認、書類のスキャンなど、正確さが求められる事務補助業務に携わってきました。実践職業訓練では、集計や文書作成を学び、作業手順を確認してから着手する習慣を身につけました。貴社が強みを生かして長く働ける職場づくりを進めている点に魅力を感じ、志望いたしました。私は、決められた手順を守り、丁寧かつ正確に処理することを得意としています。業務の優先順位や期限を確認できれば、計画を立て、安定した品質で取り組めます。月一回の通院調整と、指示をメモでも確認できる配慮をお願いしていますが、体調管理や早めの相談は自ら行います。入社後は担当業務を確実に覚え、分からない点を確認します。報告、連絡、相談を重ね、任せて安心と思っていただける存在として長く貢献したいと考えています。',
      selfPr:
        '私の強みは、手順に沿って正確に作業を続ける力と、確認した内容を記録して次の業務に生かす力です。データ入力後に元資料との照合を行い、書類を一覧で管理することで、入力漏れや重複を防いできました。請求書確認では、不明点を整理して担当者へ質問し、回答を手順書へ追記することで、確認を繰り返さないようにしました。実践職業訓練では、体調と予定を確認し、作業を分けて優先順位を付ける練習を続けています。集中が落ち始めたときは休憩と深呼吸を取り、相談することで、訓練に参加できています。急な変更や口頭指示が重なる際は整理に時間が必要ですが、メモやチャットで要点を確認できれば対応できます。業務でも見本と手順を確認し、覚えた作業を正確に積み重ねます。報告を忘れず、工夫を続けながら、チームの一員として役割を果たします。',
      requests: '月1回の通院日の勤務調整を希望します。その他は貴社規定に従います。',
      memo: 'これは配慮事項と350文字上限の確認用架空サンプルです。PDFには出力されません。',
    },
    accommodation: {
      includeDisabilityName: true,
      disabilityName: '自閉スペクトラム症（ASD）',
      includeCertificate: true,
      certificate: '精神障害者保健福祉手帳3級',
      includeHospitalVisit: true,
      hospitalVisit: '体調管理のため月1回、平日に通院しています。',
      includeMedication: true,
      medication: '主治医の指示どおり服薬しており、現在の体調は安定しています。',
      includeSupportContact: true,
      supportContact: '地域就労相談センター（担当：田中）',
      strengths: '手順が明確な作業を正確に継続し、確認結果を記録して次の業務に生かせます。',
      difficultSituations: '急な予定変更や、複数の口頭指示が同時に重なると、情報の整理に時間が必要です。',
      requestedAccommodations: '指示や変更点をメモ・チャットでも確認できることと、月1回の通院日の勤務調整をお願いします。',
      selfCare: '毎朝体調と予定を確認し、作業を小さく分けて優先順位を整理しています。',
      warningSigns: '集中が続きにくくなり、確認回数が増えることがあります。早めに休憩と相談を行います。',
      textAlignments: {},
    },
  };
};

export const updateTimestamp = (resume: ResumeData): ResumeData => ({
  ...resume,
  updatedAt: now(),
});
