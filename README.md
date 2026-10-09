# Rirekisho Studio

日本向けの履歴書をブラウザ内で作成し、PDF・Word・Excelとして保存できるReactアプリです。

- 公開URL: https://resume.nuconeko-garden.com/
- Works: https://nuconeko-garden.com/works/
- Repository: https://github.com/NucoNekoSan/Rirekisho-Studio

## Features

- A4縦2ページ・A3横1枚の履歴書PDF
- PDFに近い履歴書の様式で、編集可能なWord（.docx）・Excel（.xlsx）を書き出し。A4縦・A3横と続きページに対応
- JPG/JPEG証明写真の切り抜き、回転、削除
- 西暦・和暦、明朝・ゴシック、項目別文字揃え
- 必要な場合だけ有効化できる配慮事項シート
- 明示的な同意後にだけ利用するIndexedDB端末保存
- 用途別の複数履歴書、複製、名前変更、削除
- schema v2 JSON書き出し・読込とschema v1互換読込
- PWA、キーボード操作、オフラインマニュアル

## Privacy Boundary

履歴書本文、氏名、住所、電話番号、写真、配慮事項はCloudflareや運営者のサーバーへ送信しません。端末保存は利用者が有効化した場合だけIndexedDBへ行います。localStorageには保存同意のような個人情報ではない設定だけを保存します。

外部通信は、住所検索時に正規化済みの7桁郵便番号をzipcloudへ送る場合だけです。JSONファイルは平文なので、利用者自身が安全な場所で管理する必要があります。

- プライバシーポリシー: https://resume.nuconeko-garden.com/privacy
- 利用規約: https://resume.nuconeko-garden.com/terms

## License

ソースコードは [MIT License](LICENSE) で公開します。第三者ライブラリについては [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

## Stack

- React 19 / TypeScript / Vite / React Router
- IndexedDB
- html2canvas / jsPDF / docx / ExcelJS
- Vitest / Testing Library / Playwright
- Cloudflare Workers Static Assets / Workers Builds

## Development

```powershell
npm install
npx playwright install chromium
npm run dev
```

```powershell
npm run check
```

## Deployment

`wrangler.jsonc`は`dist`をSPAとして配信し、`resume.nuconeko-garden.com`をカスタムドメインに設定します。

```powershell
npm run deploy
```

Workers Buildsではproduction branchを`main`、build commandを`npm run build`、deploy commandを`npx wrangler deploy`に設定します。初回のCloudflare・GitHub認証と権限承認はアカウント所有者が行います。

[Works](https://nuconeko-garden.com/works/)に掲載済みです。利用URLは `https://resume.nuconeko-garden.com/` です。

## Maintenance

運用手順は[保守マニュアル](MAINTENANCE.md)、最終統合と配備の確認結果は[引き継ぎ資料](docs/HANDOFF.md)を参照してください。
