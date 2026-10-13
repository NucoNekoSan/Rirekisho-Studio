export type TutorialTarget = 'basic' | 'photo' | 'history' | 'license' | 'appeal' | 'preview-panel' | 'output';

export type TutorialStep = { target: TutorialTarget; title: string; description: string };

export const demoTutorialSteps: readonly TutorialStep[] = [
  { target: 'basic', title: '架空の基本情報を編集する', description: '山田太郎さんの氏名や住所を試しに書き換えてください。入力すると仕上がり見本も変わります。' },
  { target: 'photo', title: '写真の操作を試す', description: '写真の選択、回転、削除を試せます。写真の追加は任意です。追加した写真も端末保存されません。' },
  { target: 'history', title: '学歴・職歴の行を編集する', description: '学校名や年月を書き換え、行の追加・移動・削除を試してください。試す順番は自由です。' },
  { target: 'license', title: '免許・資格を編集する', description: '資格名や取得年月を書き換え、必要なら行を追加してみてください。' },
  { target: 'appeal', title: '文章を編集する', description: '志望動機や自己PRを編集します。「大きく編集」も試せます。作業メモは出力に含まれません。' },
  { target: 'preview-panel', title: '仕上がり見本を操作する', description: '全体表示・拡大表示を切り替え、入力した内容と用紙への収まりを確認してください。' },
  { target: 'output', title: 'デモのファイルを保存する', description: '用紙形式を切り替え、仕上がり見本の書き出しからPDF・Word・Excelを保存できます。ファイル名にはdemo-が付きます。' },
];
