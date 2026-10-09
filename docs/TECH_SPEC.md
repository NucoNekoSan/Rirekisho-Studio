# 技術仕様

## 技術スタック

- フロントエンド: React 19 + TypeScript + Vite
- PDF生成: HTML A4縦/A3横プレビュー → html2canvas → jsPDF
- Office生成: 履歴書データ → 共通ページ構成 → docx / ExcelJS → ブラウザ内Blobダウンロード。PDFに近いA4縦2ページまたはA3横1ページの履歴書様式を表で再現する。Wordの文字・表、Excelのセルは編集可能。入り切らない学歴・職歴は続きページへ出力し、Excelではページごとにシートを分ける。
- データ保存: 明示同意後のIndexedDB、およびJSONファイルのダウンロード/アップロード
- デプロイ: Cloudflare Workers Static Assets。Node.jsはビルド時のみ使用。
- 型チェック: TypeScript strict モード。

## データフロー

1. 利用者がブラウザのメモリ上で履歴書データを入力する。端末保存へ同意した場合だけIndexedDBへ自動保存する。
2. 任意のJPG/JPEG写真をブラウザのcanvasで処理し、Reactのstateに保持する。
3. 利用者はschema v2 JSONとして単一書類をエクスポートできる。写真はデフォルトで除外され、配慮事項は追加書類が有効な場合だけ含まれる。schema v1は互換読込する。
4. PDF表示ではクリック処理中に生成中タブを開き、その後にA4縦またはA3横プレビューのDOMをキャプチャしてBlob iframeへ反映する。新しいタブがブロックされた場合、UIがエラーを報告し、利用者はPDFダウンロードを使用できる。
5. 履歴書本文、写真、障害・配慮事項はサーバーへ送信しない。住所検索時だけ、正規化済みの7桁郵便番号をzipcloudへ送信する。
6. Word・Excel出力では作業メモを除外する。配慮事項は追加書類が有効で、利用者が含める保存操作を選んだ場合だけ出力する。PDFの文字数・A4ページ数による出力停止は適用しない。

## 写真設定

- 写真仕様は `src/lib/config.ts` に集約する。
- ファイルサイズ上限は `PHOTO_MAX_FILE_SIZE_MB`（10MB）からバイト値を導出し、バリデーション、UIメッセージ、テストで共通参照する。
- 受け入れ形式は `PHOTO_ACCEPTED_MIME_TYPES` と `PHOTO_ACCEPTED_EXTENSIONS` で定義し、JPG/JPEG（`image/jpeg`）のみとする。
- 出力は `PHOTO_ASPECT_RATIO` の3:4、幅 `PHOTO_OUTPUT_WIDTH` の900px、高さは比率から算出する。
- JPEG圧縮品質は `JPEG_QUALITY` の0.92を写真処理とPDF出力で共通参照する。
- A4縦履歴書は2ページ固定とし、容量見積りが2ページを超えた場合はPDF表示・保存を停止する。

## Cloudflare Workersデプロイ

- ビルド: `npm run build`
- `npx wrangler deploy`で`dist/`を配備する。
- `wrangler.jsonc`でSPA fallbackとカスタムドメインを定義する。
- `public/_headers`でCSPと安全ヘッダーを定義する。
- 公開マニュアルのJavaScriptはCSPに適合する外部ファイルとして配布し、Markdown全章をPWAにプリキャッシュする。
- `scripts/serve-dist.mjs` はテスト時に `_headers` の安全ヘッダーを適用して `dist/` を配信する。
