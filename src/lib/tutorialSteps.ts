export const tutorialSteps = [
  { target: 'basic', title: '基本情報を入力する', description: '氏名、ふりがな、生年月日、住所と連絡先を入力します。郵便番号は7桁で入力すると住所候補を確認できます。' },
  { target: 'photo', title: '写真を選ぶ', description: '必要に応じてJPGまたはJPEGの証明写真を選びます。取り込み後に回転や削除ができます。' },
  { target: 'history', title: '学歴・職歴を入力する', description: '最初の「学歴」は見出しです。その下の入学・卒業行の年、月、内容を書き換えます。行の追加・移動・削除もできます。' },
  { target: 'license', title: '免許・資格を入力する', description: '取得した年、月、正式名称を入力します。該当するものがなければ空欄のままで構いません。' },
  { target: 'appeal', title: '志望動機と希望を入力する', description: '応募先に合わせて志望動機と自己PRを書きます。本人希望欄の初期文は必要に応じて直せます。作業メモは書き出しに含まれません。' },
  { target: 'preview-panel', title: '仕上がりを確認する', description: '入力内容が見本に反映されます。用紙形式、文字の収まり、写真を確認し、必要ならPDFを別タブで開きます。' },
  { target: 'output', title: '入力データと完成ファイルを保存する', description: '再編集するには入力データをJSONで保存します。提出用は仕上がり見本の書き出しからPDF・Word・Excelを選んで保存します。' },
] as const;

export type TutorialTarget = (typeof tutorialSteps)[number]['target'];
