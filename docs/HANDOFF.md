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
- 未追跡の`.claude/`は今回の統合・配布対象外。

## 本番反映記録

検証済み統合をGitHubへ反映後、対象コミット・配備バージョン・公開確認結果を追記する。
