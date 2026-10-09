# 利用者向けマニュアル — ドラフト運用ルール

このディレクトリは `rirekisho-builder` の利用者向けマニュアル（A4縦/A3横対応版）の正本です。
`public/manual/` の公開版、やさしい日本語版、HTML版は本ドラフトを骨格として派生させます。

## 構成

```
docs/manual/draft/
├── README.md           — このファイル（運用ルール）
├── INDEX.md            — 目次
├── 01-introduction.md  — 第1章 はじめに
├── 02-overview.md      — 第2章 全体の流れ
├── 03-input-guide.md   — 第3章 入力ガイド
├── 04-accommodation.md — 第4章 配慮事項シート
├── 05-pdf-output.md    — 第5章 PDFを確認・保存
├── 06-save-load.md     — 第6章 入力データの保存・読込
├── 07-faq.md           — 第7章 よくある質問・トラブル
├── 08-appendix.md      — 第8章 巻末資料
└── img/                — スクリーンショット・図版（PNG）
```

## 更新追従ルール

ツール側で次の値や文言が変わった場合は **同じコミット内** でマニュアルも更新する。

| ツール側 | マニュアル側で更新する箇所 |
|---|---|
| `src/components/PdfPages.tsx` の `HISTORY_LAYOUT` | 03-input-guide.md §3-3、08-appendix.md §8-5 のA4/A3固定行数 |
| `src/lib/config.ts` の写真設定 | 03-input-guide.md §3-2 の形式、容量、縦横比 |
| `src/lib/accommodation.ts` のフィールド追加・削除 | 04-accommodation.md フィールド一覧表 |
| `src/lib/defaults.ts` の `requests` 初期値 | 03-input-guide.md §3-5 例文 |
| ボタンラベル変更（App.tsx） | 該当ステップのスクリーンショット差し替え |

## スクリーンショット運用

- 解像度：縦長表示で 1400px 幅程度（Retina で実印刷後にぼやけないサイズ）
- 形式：PNG（軽量化のため指示色は赤・矢印は実線）
- 命名：`{章番号}-{順序}-{内容}.png` 例 `03-04-postal-lookup.png`
- 撮影状態：デモデータ「A4縦・障害者雇用デモ」入力後の状態を基準にする（個人情報を見せないため）

## 派生版の生成順序

1. 本ドラフト（A4縦/A3横対応版）を確定。
2. INDEXと第1章〜第8章を `public/manual/` へ同期する。
3. やさしい日本語＋総ルビ版を `docs/manual/easy/` へコピーし書き換え。`<ruby>` で総ルビ。
4. HTML版を `docs/manual/html/` へ。`alt` テキスト・見出し階層検証。

公開版の「最新版の作成日」は、`npm run build`時に`scripts/stamp-manual-date.mjs`が日本時間の当日へ自動更新する。ソース側の日付を手作業で更新する必要はない。

## レビュー記録

レビュー時の指摘は `docs/manual/REVIEW_LOG.md` に追記する。版間で共通の改善は本ドラフトへ反映してから派生版に伝播させる。
