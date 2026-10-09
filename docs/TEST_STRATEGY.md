# テスト戦略

## 重要な回帰テスト領域

- 追加書類を無効にした履歴書PDFに配慮事項の情報が含まれないこと。
- 配慮事項シートが項目別ON/OFFを正しく反映すること。
- 写真アップロード設定が単一の設定値を参照すること。
- 写真のMIME、拡張子、容量、JPEG実データがアップロードとJSON読込で同じ受入条件に従うこと。
- 写真がデフォルトでJSON保存から除外されること。
- 追加書類を無効にしたJSON保存に配慮事項データが含まれないこと。
- 個人情報にブラウザストレージが使用されないこと。
- 静的デプロイ後もPDF生成が動作すること。
- セクション完了状態が必須入力ルールと一致すること。
- A4縦とA3横で固定レイアウト、背景、用紙寸法が正しく切り替わること。
- A4縦が2ページに収まらない場合、内容を切り捨てずPDF出力を停止すること。
- Enterキーと矢印キーによるフォーカス移動が、入力種別、カーソル位置、IME変換状態の規則に従うこと。
- 本番CSP下で公開マニュアルとPDF新規タブが動作すること。
- 保存JSONの包含フラグが読込時にも写真・配慮事項の境界を守ること。

## 現在のテスト

- `App.test.tsx`: アクセシビリティラベル、通常入力ワークフロー、出力制御、保存/読込UIの文言
- `components/PdfPages.test.tsx`: A4縦/A3横PDFの構造、用紙切替、PDFテキスト揃え
- `browser/pdfRenderer.test.ts`: A4/A3キャンバス処理とポップアップブロック時の処理
- `browser/photoLoader.test.ts`: 写真形式・容量検証、Canvas切り抜き、回転
- `browser/downloadFile.test.ts`: Blob/JSONダウンロードとObject URL破棄
- `components/EditableRows.test.tsx`: 行編集、文字揃え、移動、削除、追加
- `components/PreviewPanel.test.tsx`: プレビュー切替とPDF操作の委譲
- `components/ReloadPrompt.test.tsx`: PWA更新と後回し操作
- `hooks/useGridKeyboardNav.test.tsx`: 通常フォームと表グリッドのEnter・矢印キーナビゲーション、IME変換中とMac Safariの誤移動防止
- `accommodation.test.ts`: 開示制御
- `alignment.test.ts`: テキスト揃えの解決
- `config.test.ts`: 写真サイズ設定の導出
- `dateFormat.test.ts`: 西暦/和暦の日付フォーマット
- `inputFormat.test.ts`: 電話番号・郵便番号の入力整形
- `postalCode.test.ts`: 郵便番号の正規化と住所検索応答
- `printPagination.test.ts`: 履歴書/配慮事項ページのA4セマンティックページネーション
- `projectFile.test.ts`: JSON保存/読込、schema v1移行、写真除外、無効な配慮事項除外
- `resumeRepository.test.ts`: IndexedDBの保存、一覧、複製、削除
- `sectionStatus.test.ts`: セクション完了状態のルール
- `storageBoundary.test.ts`: ブラウザストレージ境界
- `textNormalize.test.ts`: PDF向けテキスト正規化
- `validation.test.ts`: メールアドレス等の入力検証
- `e2e/security.spec.ts`: CSP、HTTP境界、XSS、PII保存、悪性JSON・画像の動的診断

## 品質ゲート

- `typecheck:test`: 本番コードとテストコードをTypeScript strictで検査する。
- `test:coverage`: lines/statements/functions 70%以上、branches 60%以上を必須とする。
- `check:deploy`: `_headers`、Wrangler SPA fallback、カスタムドメイン、CSP互換HTML、マニュアル配備、Service Workerプリキャッシュを検査する。
- `check:security`: 秘密情報らしい値、危険API、CSP、source map、開発ファイルの配備混入を検査する。
- `test:security`: 本番成果物に対する静的検査とChromiumセキュリティE2Eを実行する。
- `security:sca`: 開発依存込みと本番依存のみのnpm脆弱性監査を実行する。
- `test:e2e`: Chromiumでデスクトップ・390px幅、A4/A3、A4超過停止、PDFポップアップ、JSON往復、CSPマニュアル、オフラインマニュアルを検証する。

## Office出力の回帰確認

- `officeExportData.test.ts`: 非公開メモ・非表示性別・機微項目の除外と学歴・職歴の続きページ。
- `officeRenderer.test.ts`: 編集可能なOOXMLパッケージ、セル、結合範囲、印刷範囲の確認。
- `e2e/office-export.spec.ts`: A4・A3、配慮事項の選択、写真を含むファイル、31行の学歴・職歴の欠落防止、非公開内容の除外、WordのセクションとExcelの用紙・印刷範囲を確認。
