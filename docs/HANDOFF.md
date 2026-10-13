# 最終引き継ぎ — Rirekisho Studio

確認日: 2026-10-09（日本時間）

## 統合対象

- 基準main: `673878edfb2444404a3b95aaa80e6d448076d13d`
- 作業ブランチ: `c8dfeb17530e8dc8c0847c4de4cfbcfd952d3d19`
- mainの長文拡大編集、公開導線、マニュアル戻りリンク、作成日の自動設定を保持。
- Word・Excelの編集可能な履歴書出力と、プレビュー・出力のアクセシビリティ改善を統合。
- JSON schema v2／v1読込互換、保存同意、IndexedDB構造、通信境界は変更しない。

## 検証記録

- Node.js 24.15.0、npm 11.12.1、Chromiumで検証。
- `npm run check`: 成功。lint、テスト型検査、単体127件（26ファイル）、ビルド、文書同期、配備・セキュリティ静的検査、E2E 23件。
- カバレッジ: statements 78.57%、branches 73.57%、functions 73.78%、lines 81.04%。既定閾値をすべて達成。
- `npm run security:sca`: 開発依存込み／本番依存のみ、いずれも脆弱性0件。
- 開発・配備依存の既知脆弱性を互換範囲内で修正。lockfileのWrangler 4.149.0、sharp 0.35.5、source-map-js 1.2.2等へ更新。
- 実際に写真を読み込み、A4・A3それぞれのWord・Excelを保存。31行の履歴、写真メディア、用紙寸法、印刷範囲、非公開メモと未選択の配慮事項の除外を生成パッケージで確認。
- 390px・1440pxの画面を目視確認。長文ダイアログのEscapeとフォーカス復帰、IME、JSON往復、PDF表示、オフラインマニュアルの回帰確認も成功。
- lintはプロジェクトのソース・E2E・スクリプト・公開資産・ビルド設定を対象とし、秘密情報検査では未追跡の`.claude/`を除外。ローカルの大量のスキルファイル走査による停止を防ぐ。

## 配備・復旧

- 公開URL: https://resume.nuconeko-garden.com/
- 自動配備を設定する場合: production branch `main`、build command: `npm run build`、deploy command: `npx wrangler deploy`。
- Workers Buildsの設定APIは既存OAuth権限では403となり、GitHubとの自動配備連携は確認できていない。今回の配備実績は以下へ記録する。
- 手動配備: 認証済みCloudflare環境で`npm run deploy`。SPA配信とカスタムドメインは`wrangler.jsonc`、CSPは`public/_headers`。
- 障害時はGitHub上の統合PRのマージコミットを`git revert -m 1 <merge-commit>`で戻し、検証済みのrevertをmainへ反映して再配備する。force pushや利用者のIndexedDB削除は行わない。
- 配備後にトップ、編集画面、マニュアル、法的ページ、各形式の出力とPWA更新を確認する。

## 既知の制限

- 仕上がり見本はPDFレイアウト。Word・Excelは利用するOfficeアプリの印刷プレビューで最終確認が必要。
- 本環境にWord・Excel・LibreOfficeはなく、Office実機での改ページ・印刷結果は未確認。OOXML構造とブラウザ保存の検証結果を実機目視確認と混同しない。
- Word・Excelをアプリへ読み戻す機能はない。再編集用にJSONを保存する。
- スクリーンリーダーによる実機手動QAは未実施。
- ExcelJSの圧縮済みチャンクは約940kB。ビルドのサイズ警告は残るが、出力処理は遅延読込し、PWAでオフライン出力用にプリキャッシュする。
- 未追跡の`.claude/`は今回の統合・配布対象外。

## 本番反映記録

- 統合PR: [#1](https://github.com/NucoNekoSan/Rirekisho-Studio/pull/1)（2026-10-09 17:29 JSTにマージ）。
- 検証済み統合コミット: `3a5a37a04a32099a9a68fa48e13394c3fc70986b`。
- mainのマージコミット／配備対象: `c33c6db542c8cc505c33cf36c8f8fe884844cdec`。
- マージ後の公開サイトは旧成果物だったため、認証済みWranglerで手動配備。`npm run deploy -- --tag c33c6db --message "Final handoff: main c33c6db542c8cc505c33cf36c8f8fe884844cdec"`が成功。
- Cloudflare Worker: `rirekisho-studio`。配備バージョン: `954120fa-d579-438e-9425-5fe81ba73263`。カスタムドメイン `resume.nuconeko-garden.com` に反映。
- 配備後、公開する全37ファイル（配信ヘッダー設定ファイル`_headers`を除く）がローカルの`dist/`とバイト単位で一致。HTML、全JS/CSS、Service Worker、マニュアル、アイコン、sitemapを照合。
- `/`、`/app`、`/manual/`、`/privacy`、`/terms`はHTTP 200。CSPとページ表示を確認し、未処理JavaScript例外なし。
- 公開サイトでA4・A3それぞれのPDF・Word・Excel、合計6ファイルを実際に保存。PDFヘッダーとOffice ZIPヘッダー、ファイルサイズを確認。
- 長文ダイアログの編集・Escape・フォーカス復帰、同意後のIndexedDB保存と再読込、マニュアル第5章・編集画面への戻り導線を確認。
- 配備前に開いていたPWAで更新通知を確認。「更新する」で新バージョンへ切り替わり、更新後のマニュアルがオフラインで表示できることを確認。
- 390px／1440pxの公開トップページを目視確認。モバイルで横スクロールなし。
- マニュアル作成日は公開成果物で`2026年10月9日`。今回の本番反映記録だけの後続コミットは、上記配備対象のアプリ・公開資産を変更しない。

## 書き出しUIの改善（2026-10-09）

- 保存ボタンと形式メニューを一体化。PDF・Word・Excelの形式変更だけでは保存せず、主ボタンで保存する。
- 配慮事項は初期OFFの「配慮事項も含める」チェックへ整理。PDF表示は補助操作へ移動。
- 形式メニューはPopover APIのトップレイヤーで表示し、スクロール・リサイズ時に位置を合わせる。非対応環境ではインライン展開。
- キーボード選択・Escape・フォーカス復帰、生成中の重複操作防止、PDF出力制限を確認。
- lint・型検査・ビルド・文書同期・配備・セキュリティ検査成功。単体129件、E2E26件成功。依存監査は開発／本番とも脆弱性0件。
- 320・390・1680・1681・1920pxで配置を確認。配慮事項ON時を含め、ボタンの折返しとメニューの画面外への欠けを解消。
- 改善PR: [#2](https://github.com/NucoNekoSan/Rirekisho-Studio/pull/2)。mainの配備対象コミット: `45c6972f9d135d29dec4194c23b594d96093a694`。
- Cloudflare配備バージョン: `d52fab7d-46ec-4a31-bd06-8eab10a6a1d4`。公開37ファイルが検証済みビルドとバイト単位で一致。
- 本番5ルートの表示・CSP、A4/A3のPDF・Word・Excel計6ファイルの保存、端末保存と再読込、マニュアル導線を確認。未処理JavaScript例外なし。
- 配備前から開いていたPWAの更新通知・更新適用・更新後のオフラインマニュアルを確認。
- この本番確認記録の後続コミットはアプリ・公開資産を変更しない。

## Word/Excel往復インポートとデモ拡充（2026-10-13）

### 統合対象

mainに積んだコミット（`f0f1621`以降、`c8cdc49`まで）:

- `f5c4172` Word/Excel往復インポート機能。アプリが生成した`.docx`/`.xlsx`を編集して「入力データを読込」から読み込むと、変更した文字・学歴職歴/資格の行・JPEG写真が入力欄に反映される。Word側はブックマーク、Excel側は定義された名前をフィールドのアンカーとして使用（`src/browser/officePackage.ts`、`src/lib/officeAnchor.ts`）。この作業は元々Codexが未コミットのまま残していたもので、ビルド・型検査・lint・既存テストがすべて成功していることを確認した上で引き継ぎ、1件のみ残っていた無関係なテストの文字列アサーションのずれ（`src/App.test.tsx`）を直して完了させた。
- `1142826` 未追跡だった`.claude/`を`.gitignore`へ追加（Claude Code自身の設定ディレクトリで、配布・統合対象外）。
- `2b09a4d` 本番で確認したCSPブロックを修正。`script-src`/`connect-src`にCloudflareの計測ビーコン（`static.cloudflareinsights.com`／`cloudflareinsights.com`）だけを個別に許可（ワイルドカードや`unsafe-*`は使用しない）。
- `2d7d0c5` デモ(`/demo`)チュートリアルの最終ステップと、マニュアル第6章・目次・FAQ（`docs/manual/draft/`・`public/manual/`両方）に往復インポート機能の説明を反映。
- `b089dee` デモでも「入力データ保存」操作を実際に試せるように変更。保存ボタン・写真チェックボックスはデモで表示し、読込ボタンとデータ初期化カードは引き続き非表示のまま。保存時のファイル名にデモでは`demo-`接頭辞が付くよう統一。
- `c8cdc49` デモに「配慮事項シートを試す（任意）」ステップを追加。従来、基本情報・写真・学歴職歴・免許資格・志望動機・出力の各セクションにはチュートリアルステップがあったが、配慮事項シートのセクションだけ案内が無かったため追加。

### 検証記録

- Node.js環境（Windows）、Chromium（Playwright）で検証。
- `npm test`: 146/146成功。`npm run lint`（oxlint）: エラー無し。`npm run build`（`tsc -b && vite build`）: 成功。
- `npm run check:docs`・`npm run check:deploy`・`npm run check:security`: いずれも成功。
- E2E: `e2e/office-export.spec.ts`（往復インポート含む7件）、`e2e/security.spec.ts`・`e2e/manual.spec.ts`（CSPヘッダー検証含む9件）、いずれも成功。
- 各コミットのデプロイ後、本番（`https://resume.nuconeko-garden.com`）に対しPlaywrightで実機確認: Word往復インポート（書き出し→編集→再読込→反映）、CSPヘッダーの実値とコンソールエラー解消、デモの「入力データ保存」操作（`demo-rirekisho-studio-project.json`のダウンロード）、デモの配慮事項シート展開。

### 配備・復旧

- 公開URL: `https://resume.nuconeko-garden.com/`。
- 手動配備: 認証済みCloudflare環境（アカウント`nuconekosan@gmail.com`）で`npm run deploy`（`npm run build && wrangler deploy`）。SPA配信とカスタムドメインは`wrangler.jsonc`、CSPは`public/_headers`。
- 最終配備のCloudflare Workerバージョン: `d46efbe3-06bd-4337-8ab9-27125ab74ead`（コミット`c8cdc49`相当、Worker名`rirekisho-studio`）。
- 障害時の復旧方針は既存章と同様（`git revert -m 1 <merge-commit>`等）。force pushや利用者のIndexedDB削除は行わない。

### 既知の制限・今後の候補（更新）

- Word・Excelの往復インポート機能は実装済みで本番動作確認済み。従来この章の冒頭付近に記載していた「Word・Excelをアプリへ読み戻す機能はない」という記述は本リリースで解消された。
- デモの往復インポートは「保存」操作のみ体験可能。「読込」（往復インポートのフル体験）はデモの安全性（実データ上書きを避ける設計）を優先し、意図的に対象外のまま。
- 「書式設定（文字揃え）」トグルは各入力セクションに存在するが、デモチュートリアルの専用ステップはまだ無い（既存ステップ内で発見可能なため優先度を下げて保留）。次にチュートリアルを拡充する場合の候補。

### 現在の状態

- `main`は`origin/main`と同期済み（2026-10-13時点、最新コミット`c8cdc49`）。
- 作業ツリーはクリーンで、未コミット・保留中の作業は無い。
