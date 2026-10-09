# 運用・保守マニュアル

このドキュメントは、Rirekisho Studioを保守する開発者向けの運用・保守ガイドです。

> 本番環境はCloudflare Workers Static Assetsです。配備設定は`wrangler.jsonc`、安全ヘッダーは`public/_headers`を参照してください。最終統合・検証・復旧の記録は[引き継ぎ資料](docs/HANDOFF.md)にまとめています。
システム全体像の把握から、日常的なUI変更、PDFレイアウト調整、デプロイまでをカバーします。

---

## 目次

1. [開発環境のセットアップ](#1-開発環境のセットアップ)
2. [システム全体像](#2-システム全体像)
3. [PWA（オフライン対応・インストール）](#3-pwaオフライン対応インストール)
4. [CSSテーマ・配色ガイド](#4-cssテーマ配色ガイド)
5. [PDFレイアウト調整ガイド](#5-pdfレイアウト調整ガイド)
6. [写真処理](#6-写真処理)
7. [よくある変更パターン](#7-よくある変更パターン)
8. [Cloudflareへのデプロイ手順](#8-cloudflareへのデプロイ手順)
9. [トラブルシューティング](#9-トラブルシューティング)
10. [コマンド一覧](#10-コマンド一覧)
11. [設定定数クイックリファレンス](#11-設定定数クイックリファレンス)

---

## 1. 開発環境のセットアップ

### 必要なソフトウェア

1. **Node.js**（24 LTS推奨。今回の検証環境は24.15.0）
   - https://nodejs.org/ から「LTS（推奨版）」をダウンロードしてインストール
   - インストール後、PowerShellで `node --version` を実行して確認

2. **テキストエディタ**
   - Visual Studio Code（推奨）: https://code.visualstudio.com/

### 初回セットアップ

```powershell
# 1. プロジェクトフォルダを開く
cd C:\path\to\rirekisho-studio

# 2. 依存パッケージをインストール（初回のみ、またはpackage.jsonが変わったとき）
npm ci
npx playwright install chromium

# 3. 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:5173` を開くと、アプリが表示されます。
コードを変更すると、ブラウザが自動で更新されます。

---

## 2. システム全体像

### 技術スタック

- **React 19** + **TypeScript 6** + **Vite 8**（クライアントサイドSPA）
- サーバー不要。ブラウザだけで完結する静的Webアプリ
- 履歴書本文・写真・配慮事項はサーバーへ送信しない。初期設定はメモリのみで、本人が明示的に同意した場合だけIndexedDBへ保存する。
- localStorageは保存同意などの設定だけを保存する。住所検索時は正規化した7桁郵便番号だけをzipcloudへ送信する。

### データの流れ

```
ユーザー入力
    ↓
AppState（React state）
    ↓
PdfPages.tsx（HTMLテンプレート → DOMに描画）
    ↓
html2canvas（DOM → Canvas画像化）
    ↓
jsPDF（Canvas → PDFファイル）
    ↓
PDF保存 / 新規タブ表示
```

### ファイル構成と各ファイルの役割

```
src/
├── App.tsx              … メイン画面（全入力フォーム＋状態管理）
├── App.css              … 画面UI＋PDF印刷スタイル（CSS変数で配色集約）
├── App.test.tsx          … App.tsx のテスト
├── main.tsx             … エントリポイント（ReactをDOMにマウント）
├── index.css            … グローバルリセットCSS
│
├── components/
│   ├── PdfPages.tsx     … PDF出力用HTMLテンプレート（A4/A3履歴書＋配慮事項シート）
│   ├── PdfPages.test.tsx … PdfPages のテスト
│   ├── PreviewPanel.tsx … PDFプレビューパネル
│   ├── OutputPanel.tsx  … PDF・Word・Excelの形式と出力内容の選択
│   └── ReloadPrompt.tsx … PWA更新プロンプト（新バージョン通知バナー）
│
├── browser/
│   ├── pdfRenderer.ts   … html2canvas + jsPDF でPDF生成
│   ├── pdfRenderer.test.ts … pdfRenderer のテスト
│   ├── photoLoader.ts   … 写真の読み込み・クロップ・回転処理
│   └── downloadFile.ts  … プロジェクトファイル保存
│
├── hooks/
│   ├── usePostalLookup.ts … 郵便番号→住所自動入力フック
│   └── useOnlineStatus.ts … ネットワーク接続状態の監視フック（PWA用）
│
├── lib/
│   ├── config.ts        … 共通定数（写真サイズ、JPEG品質など）
│   ├── types.ts         … 全型定義（AppState, ResumeData 等）
│   ├── defaults.ts      … 初期値・デモデータ生成
│   ├── printPagination.ts … PDFページ分割アルゴリズム
│   ├── accommodation.ts … 配慮事項シートのデータ処理
│   ├── sectionStatus.ts … 入力セクションの完了状態判定
│   ├── dateFormat.ts    … 和暦・西暦の日付フォーマット
│   ├── inputFormat.ts   … 電話番号・郵便番号のフォーマット
│   ├── textNormalize.ts … テキスト正規化
│   ├── alignment.ts     … テキスト配置（左/中央/右）
│   ├── validation.ts    … 入力バリデーション
│   ├── projectFile.ts   … プロジェクトファイル読み書き
│   ├── postalCode.ts    … 郵便番号API呼び出し
│   └── *.test.ts        … 各ライブラリのテストファイル
│
├── vite-pwa.d.ts        … vite-plugin-pwa の型宣言
│
└── test/
    └── setup.ts         … テスト環境のセットアップ
```

`public/` ディレクトリ内のPWA関連ファイル:

```
public/
├── favicon.svg              … SVGアイコン（元画像）
├── favicon.ico              … ICOアイコン（48x48）
├── pwa-64x64.png            … PWAアイコン 64px
├── pwa-192x192.png          … PWAアイコン 192px
├── pwa-512x512.png          … PWAアイコン 512px
├── maskable-icon-512x512.png … マスカブルアイコン（丸型切り抜き対応）
├── apple-touch-icon-180x180.png … iOS用ホーム画面アイコン
└── ...
```

### PDF出力の2つの方式

| 方式 | 用途 | 制御ファイル |
|------|------|-------------|
| **固定レイアウト**（A4 2ページ / A3 1枚） | 標準履歴書出力 | `PdfPages.tsx` の `HISTORY_LAYOUT` |
| **動的ページ分割** | 内容量に応じてページ数が増える自動分割 | `printPagination.ts` の定数群 |

---

## 3. PWA（オフライン対応・インストール）

### PWAとは

PWA（Progressive Web App）は、通常のWebサイトをスマートフォンやPCのアプリのように使える技術です。このアプリでは以下の機能を提供します:

- **オフライン動作**: インターネットに接続していなくても、アプリの画面を開いて履歴書を作成できます（郵便番号検索のみオフラインでは使用不可）
- **ホーム画面に追加**: スマートフォンやPCのホーム画面にアイコンを配置して、ブラウザのアドレスバーなしでアプリを起動できます
- **自動更新**: 新しいバージョンをデプロイすると、次回アクセス時に「更新する」ボタンが表示されます

### 構成要素

| ファイル | 役割 | 生成方法 |
|---------|------|---------|
| `dist/manifest.webmanifest` | アプリ名・アイコン・テーマカラーなどの定義 | `vite-plugin-pwa` がビルド時に自動生成 |
| `dist/sw.js` | Service Worker（静的ファイルのキャッシュを管理） | `vite-plugin-pwa`（Workbox）がビルド時に自動生成 |
| `vite.config.ts` | PWA設定の定義場所 | 手動で編集 |
| `src/components/ReloadPrompt.tsx` | 更新通知バナーのUI | 手動で編集 |
| `src/hooks/useOnlineStatus.ts` | オフライン検出 | 手動で編集 |

### キャッシュ戦略

Service Workerは以下のルールでキャッシュを管理します:

| 対象 | 戦略 | 説明 |
|------|------|------|
| HTML / CSS / JS / 画像 | **プリキャッシュ** | ビルド時にファイル一覧を生成し、初回アクセスですべてキャッシュ。オフラインでも即座に表示 |
| zipcloud API（郵便番号検索） | **NetworkOnly** | 常にネットワーク経由。オフライン時はエラーメッセージを表示 |
| ユーザーの個人情報 | **Service Workerではキャッシュしない** | 本人の同意後のIndexedDB保存は別の仕組み。履歴書本文・写真を静的アセットのキャッシュへ混ぜない |

### カスタマイズ方法

#### アプリ名・説明文の変更

`vite.config.ts` の `manifest` オブジェクト内を変更します:

```typescript
manifest: {
  name: '履歴書作成ツール',       // フルネーム（インストール画面に表示）
  short_name: '履歴書作成',       // ホーム画面のアイコン下に表示（短く）
  description: '履歴書をPDFで作成できるツールです',
},
```

#### テーマカラーの変更

テーマカラーはブラウザのアドレスバーやスプラッシュ画面の色に使用されます。変更する場合は**3箇所を同時に変更**してください:

| 変更場所 | ファイル | 該当箇所 |
|---------|---------|---------|
| CSS変数 | `src/App.css` | `:root { --color-primary: #2f5d50; }` |
| マニフェスト | `vite.config.ts` | `manifest: { theme_color: '#2f5d50' }` |
| HTMLメタタグ | `index.html` | `<meta name="theme-color" content="#2f5d50">` |

背景色（`background_color`）も同様に `vite.config.ts` と `src/App.css`（`--color-bg-page`）を揃えます。

#### アイコンの変更

1. `public/favicon.svg` を新しいSVG画像に差し替える
2. 以下のコマンドでPNG各サイズを再生成:

```powershell
npx @vite-pwa/assets-generator --preset minimal-2023 public/favicon.svg
```

3. `npm run build` で反映を確認

### 更新プロンプトの動作

`vite.config.ts` で `registerType: 'prompt'` を設定しています。動作の流れ:

1. デプロイ後、ユーザーがアプリを開く
2. バックグラウンドでService Workerが新バージョンを検出
3. 画面下部に「新しいバージョンが利用可能です。」バナーが表示
4. 「更新する」ボタンを押すとページがリロードされ、新バージョンに切り替わる
5. 「後で」を押すとバナーが閉じ、次回アクセス時に再表示

入力中のデータが消えないよう、自動リロード（`autoUpdate`）ではなくユーザー確認式にしています。

### オフラインインジケーター

ネットワーク切断時、入力フォーム上部に「オフラインです。郵便番号検索は利用できません。」という警告バナーが表示されます。オフラインでも履歴書の入力・PDF出力は正常に動作します。

### ストレージポリシーとの関係

Service Workerの Cache API は静的アセット（HTML、CSS、JS、アイコン画像）のみをキャッシュします。入力した個人情報をCache APIやlocalStorageへ保存しません。本人が端末保存を有効にした場合だけ、履歴書本文・写真・有効な配慮事項をIndexedDBへ保存します。この設計はブラウザストレージポリシー（`docs/BROWSER_STORAGE_POLICY.md`）に準拠しており、`src/lib/storageBoundary.test.ts` のガードテストも引き続き通過します。

---

## 4. CSSテーマ・配色ガイド

### CSS変数の仕組み

すべての配色・フォント・角丸・影は `src/App.css` 冒頭の `:root` ブロックにCSS変数として定義されています。ファイル内の各スタイルはこの変数を参照しているため、**変数の値を変えるだけで配色を一括変更**できます。

```css
:root {
  --color-primary: #2f5d50;       /* ← この値を変えると全ボタン色が変わる */
  --color-primary-hover: #24483f;
  --color-bg-page: #f3f5f1;       /* ← ページ全体の背景色 */
  /* ... */
}
```

### 変数のカテゴリ

| カテゴリ | 変数プレフィックス | 用途 |
|---------|------------------|------|
| ブランドカラー | `--color-primary-*` | ボタン、アクティブ状態、ナビゲーション |
| テキスト | `--color-text-*` | 本文、見出し、ヒント、プレースホルダー |
| 背景 | `--color-bg-*` | ページ背景、カード、入力欄、ダイアログ |
| ボーダー | `--color-border-*` | 区切り線、入力欄の枠線 |
| 通知・成功 | `--color-notice-*` | 完了状態、成功メッセージ |
| エラー・危険 | `--color-danger-*` | エラー表示、削除ボタン |
| 警告 | `--color-warning-*` | 注意喚起の背景・枠 |
| フォーカス | `--color-focus` | キーボード操作時のフォーカスリング |
| フォント | `--font-*` | UI用フォント、PDF用ゴシック・明朝 |
| 角丸・影 | `--radius-*`, `--shadow-*` | カードの角丸、ダイアログの影 |

### 配色変更の手順

1. `src/App.css` を開く
2. ファイル冒頭の `:root { ... }` 内で変更したい変数を探す
3. 値（カラーコード）を変更する
4. 開発サーバー（`npm run dev`）で変更を即座に確認

**例: ブランドカラーを青系に変更**
```css
:root {
  --color-primary: #2f5d50;       /* ← 変更前（緑系） */
  --color-primary: #2f4f5d;       /* ← 変更後（青系） */
  --color-primary-hover: #24483f; /* ← 変更前 */
  --color-primary-hover: #1e3e4f; /* ← 変更後 */
}
```

### テキスト階調（濃い→薄い）

テキスト色は用途に応じて6段階で使い分けています:

| 変数 | 色 | 用途 |
|------|-----|------|
| `--color-text-body` | `#24302f` | 本文テキスト |
| `--color-text-strong` | `#31413e` | フィールドラベル、ガイダンス |
| `--color-text-mid` | `#41514e` | 読み取り専用、チェックリスト |
| `--color-text-desc` | `#4c5d59` | 説明文 |
| `--color-text-muted` | `#526460` | 補助テキスト、注記 |
| `--color-text-subtle` | `#63736f` | ヒントテキスト |
| `--color-text-placeholder` | `#82918c` | プレースホルダー |

### ブレークポイント（レスポンシブ対応）

画面幅に応じたレイアウト切替は `src/App.css` の末尾 `@media` クエリで制御しています:

| ブレークポイント | 動作 |
|----------------|------|
| **1480px以下** | 3カラム → 2カラム（プレビューがエディタ下に移動） |
| **820px以下** | 2カラム → 1カラム（モバイル表示） |

これらの数値を変更する場合は、`@media (max-width: ...)` の値を直接書き換えます。
（CSS変数は `@media` 内では使えないため、数値を直接記述しています）

---

## 5. PDFレイアウト調整ガイド

### 用紙サイズと余白

| 形式 | サイズ | 余白 | 制御場所 |
|------|--------|------|---------|
| A4縦 | 210mm × 297mm | 上下左右 11mm | `App.css` の `.pdf-page { padding: 11mm; }` |
| A3横 | 420mm × 297mm | 上下11mm 左右16mm | `App.css` の `.resume-a3-page { padding: 11mm 16mm; }` |

### 固定レイアウトの行数調整（HISTORY_LAYOUT）

`src/components/PdfPages.tsx` の `HISTORY_LAYOUT` で、固定ページの学歴・職歴テーブル行数を制御します:

```typescript
const HISTORY_LAYOUT = {
  a4: { primaryRows: 21, primaryMin: 21, secondaryMin: 5, qualBlanks: 5 },
  a3: { primaryRows: 22, primaryMin: 22, secondaryMin: 7, qualBlanks: 3 },
};
```

| フィールド | 意味 |
|-----------|------|
| `primaryRows` | 1ページ目（A3は左カラム）に表示する最大行数 |
| `primaryMin` | 1ページ目の最小空行数（テーブルの高さを一定に保つ） |
| `secondaryMin` | 2ページ目（A3は右カラム）の最小空行数 |
| `qualBlanks` | 免許・資格テーブルの下に追加する空行数 |

### 動的ページ分割の調整（printPagination.ts）

`src/lib/printPagination.ts` では抽象的な「単位（units）」でセクションの高さを見積もり、ページに収まるよう自動分割します。

**「単位」とは**: A4用紙の有効印刷領域（約275mm）を、フォントサイズ・行間を考慮してスケーリングした抽象値です。

主要な定数:

| 定数 | 値 | 意味 |
|------|-----|------|
| `RESUME_PAGE_CAPACITY_UNITS` | 232 | 履歴書1ページの容量 |
| `ACCOMMODATION_PAGE_CAPACITY_UNITS` | 254 | 配慮事項シート1ページの容量 |
| `RESUME_PROFILE_UNITS` | 86 | プロフィール欄の高さ |
| `RESUME_TABLE_ROW_MIN_UNITS` | 7 | テーブル1行の最小高さ |
| `RESUME_TEXT_MIN_UNITS` | 28 | テキストボックスの最小高さ |

**調整が必要になるケース**:
- CSSで `.pdf-page` の余白（`padding`）を変更した場合 → `*_PAGE_CAPACITY_UNITS` を再調整
- テーブルの行高さ（`.resume-table-block td { height: 7mm; }`）を変更した場合 → `RESUME_TABLE_ROW_MIN_UNITS` を再調整
- フォントサイズを変更した場合 → 行あたりの文字数（`*_CHARS_PER_LINE`）を再調整

### PDF用フォント

```css
:root {
  --font-pdf-gothic: "BIZ UDPGothic", "Yu Gothic UI", ...;  /* ゴシック体 */
  --font-pdf-mincho: "BIZ UDMincho", "Yu Mincho", ...;      /* 明朝体 */
}
```

ユーザーはフォーム上でゴシック / 明朝を選択可能。変更したい場合は `:root` の変数値を書き換えます。

### PDF出力の鮮明度（スケール）

`src/browser/pdfRenderer.ts` の `PDF_CANVAS_SCALE` で制御:

```typescript
export const PDF_CANVAS_SCALE = 3;  // 大きいほど高精細だがメモリ消費増
```

---

### Word・Excel出力の調整

`src/lib/officeExportData.ts`が出力対象とページ構成を決定し、`src/browser/wordRenderer.ts`と`src/browser/excelRenderer.ts`が編集可能な表・セルへ変換します。固定枠は`src/lib/resumeFixedLayout.ts`、Office用寸法は`src/lib/officeLayout.ts`を参照します。PDFの仕上がり見本はWord・Excelそのもののプレビューではありません。

A4縦・A3横の履歴書に対応し、学歴・職歴が枠を超える場合は続きページ／シートへ出力します。作業メモはPDF・Word・Excelに含めず、配慮事項は利用者が保存する内容で選択した場合だけ含めます。Officeアプリごとの改ページ差があるため、保存後の印刷プレビューを確認してください。Word・Excelを本アプリへ読み戻す機能はありません。

## 6. 写真処理

### 仕様

| 項目 | 値 | 設定場所 |
|------|-----|---------|
| 対応形式 | JPEG（.jpg / .jpeg） | `config.ts` `PHOTO_ACCEPTED_MIME_TYPES` |
| 最大ファイルサイズ | 10MB | `config.ts` `PHOTO_MAX_FILE_SIZE_MB` |
| アスペクト比 | 3:4（幅:高さ） | `config.ts` `PHOTO_ASPECT_RATIO` |
| 出力サイズ | 900 × 1200 px | `config.ts` `PHOTO_OUTPUT_WIDTH`, `PHOTO_OUTPUT_HEIGHT` |
| JPEG品質 | 0.92 | `config.ts` `JPEG_QUALITY` |

### 処理の流れ

```
ファイル選択 → バリデーション（形式・サイズ） → 3:4クロップ → 900x1200px出力
                                                      ↓
                                            回転ボタン → 90°回転 → 再クロップ
```

- `photoLoader.ts` がすべての画像処理を担当
- EXIF回転（スマホ写真の向き補正）に `createImageBitmap` APIで対応
- 出力サイズ変更は `config.ts` の `PHOTO_OUTPUT_WIDTH` のみ変更すれば、高さは自動計算

---

## 7. よくある変更パターン

### テキスト・ラベルの変更

| 変更対象 | 編集ファイル | 探し方 |
|---------|------------|--------|
| 入力フォームのラベル | `src/App.tsx` | 日本語テキストで全文検索 |
| PDF出力のラベル | `src/components/PdfPages.tsx` | 同上 |
| ページタイトル | `index.html` | `<title>` タグ |

例: 「通勤」のラベルを変えたい → ファイル内で `通勤` を検索してテキストを書き換え

### 配色の変更

`src/App.css` 冒頭の `:root` 内のCSS変数の値のみ変更。コードの他の部分を触る必要はありません。

→ 詳細は [4. CSSテーマ・配色ガイド](#4-cssテーマ配色ガイド) を参照

### フォントの変更

```css
:root {
  /* UI画面のフォント */
  --font-ui: "Yu Gothic UI", "Yu Gothic", "Meiryo", system-ui, sans-serif;

  /* PDF出力のフォント */
  --font-pdf-gothic: "BIZ UDPGothic", ...;
  --font-pdf-mincho: "BIZ UDMincho", ...;
}
```

フォント名を変更・追加するだけで反映されます。PDF用フォントはユーザーのPCにインストールされているフォントのみ使用可能です。

### サンプルデータの変更

`src/lib/defaults.ts` を編集します。

```typescript
histories: [
  { id: id(), year: '', month: '', text: '高等学校 入学' },
  { id: id(), year: '', month: '', text: '高等学校 卒業' },
  { id: id(), year: '', month: '', text: '職歴' },
  { id: id(), year: '', month: '', text: '以上' },
],
```

テキストの `''`（空文字）や文字列を変更できます。行を増やしたい場合は同じ形式で行を追加します。

### PDF行数の調整

`src/components/PdfPages.tsx` の `HISTORY_LAYOUT` 定数を変更:

```typescript
const HISTORY_LAYOUT = {
  a4: { primaryRows: 21, ... },  // A4 1ページ目の学歴・職歴行数
  a3: { primaryRows: 22, ... },  // A3 左カラムの学歴・職歴行数
};
```

→ 詳細は [5. PDFレイアウト調整ガイド](#5-pdfレイアウト調整ガイド) を参照

### ページ分割の調整

`src/lib/printPagination.ts` のページ容量定数を変更。CSSの余白やフォントサイズを変更した場合は、この定数も合わせて再調整が必要です。

→ 詳細は [5. PDFレイアウト調整ガイド](#5-pdfレイアウト調整ガイド) を参照

### 入力フィールドの追加

新しいフィールドを追加する場合の手順:

1. **`src/lib/types.ts`** — `ResumeData`（または `AccommodationData`）型にフィールドを追加
2. **`src/lib/defaults.ts`** — 初期値・デモデータに新フィールドの値を追加
3. **`src/App.tsx`** — 入力フォーム（JSX）にフィールドの入力UIを追加
4. **`src/components/PdfPages.tsx`** — PDF出力テンプレートに表示を追加
5. **品質検証** — `npm run check` で型、カバレッジ、ビルド、文書、配備、実ブラウザを確認

---

## 8. Cloudflareへのデプロイ手順

### 検証と配備

```powershell
npm ci
npx playwright install chromium
npm run check
npm run security:sca
```

Workers Buildsで自動配備を設定する場合、production branchは`main`、build commandは`npm run build`、deploy commandは`npx wrangler deploy`です。GitHubへの統合後、Cloudflareで配備成功と対象コミットを確認します。今回確認できた権限ではBuilds設定APIを取得できないため、自動連携の有無を断定せず、配備実績は引き継ぎ資料へ記録します。公開URLは `https://resume.nuconeko-garden.com/` です。

手動配備が必要な場合は、Cloudflareに認証済みの環境で以下を実行します。

```powershell
npm run deploy
```

`wrangler.jsonc`のSPA fallbackとカスタムドメイン、`public/_headers`のCSPを維持してください。マニュアルの作成日はビルド時に`dist/manual/INDEX.md`へ日本時間で設定されます。原稿の日時を都度変更する必要はありません。

配備後はトップ、`/app`、`/manual/`、`/privacy`、`/terms`、PDF・Word・Excel出力を確認します。PWAは利用者が「更新する」を選ぶまで自動再読込しません。障害時の復旧手順は[引き継ぎ資料](docs/HANDOFF.md)を参照してください。

### 旧Xserver環境の記録

2026-09-25以前は`dist/`をFTPでXserverへアップロードする方式でした。`.htaccess`を含む旧手順は現行環境では使用しません。Cloudflareへ配備する際にFTPアップロードや`.htaccess`の復元は不要です。

---

## 9. トラブルシューティング

### `npm ci` でエラーが出る

- `node --version`でNode.jsのバージョンを確認する。
- `package.json`と`package-lock.json`が同じコミットの内容か確認する。lockfileを削除せず、対応する依存更新を確認してから再実行する。

### `npm run build` でエラーが出る

- TypeScriptの型エラーの場合、エラーメッセージに表示されたファイルと行番号を確認
- `npm run test` を先に実行して、テストが通るか確認

### Cloudflareへ配備しても更新されない

- Workers Buildsの対象ブランチ、対象コミット、ビルド・配備ログを確認する。
- `wrangler.jsonc`のカスタムドメインとSPA fallbackを確認する。
- インストール済みPWAでは更新通知の「更新する」を選ぶ。利用者の保存データを消す目的でサイトデータ削除を案内しない。

### 開発サーバーが起動しない

- 別のプロセスがポート5173を使用していないか確認
- `npm install` を再実行してから `npm run dev`

### PDF出力が崩れる

- ブラウザの拡大率が100%であることを確認
- 異なるブラウザ（Chrome推奨）で試す
- `PDF_CANVAS_SCALE`（`pdfRenderer.ts`）の値を確認（低すぎると粗い出力になる）

### 配色変更が反映されない

- CSS変数名のスペルミスがないか確認（DevToolsの「Elements」→「Styles」で `:root` を確認）
- ブラウザキャッシュをクリア（Ctrl+Shift+R）
- CSS変数を使わず直接カラーコードを書いている箇所がないか確認

### 写真がアップロードできない

- JPEG形式（.jpg / .jpeg）であることを確認
- ファイルサイズが10MB以下であることを確認
- ブラウザのコンソール（F12）でエラーメッセージを確認

### アプリが古いバージョンのまま更新されない

- ブラウザのDevTools（F12）→「Application」→「Service Workers」で「Update on reload」にチェックを入れてリロード
- それでも改善しない場合: 「Application」→「Storage」→「Clear site data」でService Workerとキャッシュをすべてクリア
- デプロイ時に `sw.js` と `workbox-*.js` がアップロードされているか確認

### オフラインで動作しない

- HTTPS環境であることを確認（Service Workerはlocalhostを除きHTTPS必須）
- DevTools →「Application」→「Service Workers」でService Workerが「activated and is running」になっているか確認
- `.htaccess` の Content-Security-Policy に `worker-src 'self'` が含まれているか確認

### ホーム画面に追加できない（インストールボタンが出ない）

- HTTPS環境であることを確認
- DevTools →「Application」→「Manifest」でエラーがないか確認
- `manifest.webmanifest` がサーバーに配置されているか確認
- アイコン画像（`pwa-192x192.png`、`pwa-512x512.png`）がサーバーに配置されているか確認

---

## 10. コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm ci` | lockfileに固定した依存パッケージのインストール |
| `npm run deploy` | ビルド後にCloudflare Workersへ手動配備 |
| `npm run preview:worker` | Cloudflare Workers相当のローカル確認 |
| `npm run dev` | 開発サーバーの起動（http://localhost:5173） |
| `npm run build` | 本番用ビルド（dist/に出力） |
| `npm run preview` | ビルド結果のローカルプレビュー |
| `npm run test` | テストの実行 |
| `npm run typecheck:test` | 本番コードとテストコードのTypeScript検査 |
| `npm run test:coverage` | カバレッジ閾値付きテスト |
| `npm run test:e2e` | 本番相当CSP下のChromium E2E（事前にビルドも実行） |
| `npm run test:watch` | テストの監視モード実行（ファイル変更時に自動再テスト） |
| `npm run lint` | コードの静的チェック |
| `npm run check:docs` | Markdownリンク、マニュアル同期、Specs構造の検査 |
| `npm run check:deploy` | CSP、配備ファイル、Service Workerの検査 |
| `npm run check:security` | 秘密情報らしい値、危険API、CSP、source map、開発ファイルの検査 |
| `npm run test:security` | 本番相当環境の静的検査とChromiumセキュリティE2E |
| `npm run security:sca` | 開発依存込み・本番依存のみのnpm脆弱性監査 |
| `npm run check` | 全品質ゲートの一括実行 |

---

## 11. 設定定数クイックリファレンス

### CSS変数一覧（`src/App.css` `:root`）

#### ブランド・フォーカス

| 変数 | 既定値 | 用途 |
|------|--------|------|
| `--color-primary` | `#2f5d50` | ボタン、アクティブナビ |
| `--color-primary-hover` | `#24483f` | ホバー状態 |
| `--color-focus` | `#d7a84d` | フォーカスリング |

#### テキスト

| 変数 | 既定値 | 用途 |
|------|--------|------|
| `--color-text-body` | `#24302f` | 本文 |
| `--color-text-strong` | `#31413e` | ラベル、ガイダンス |
| `--color-text-mid` | `#41514e` | 読み取り専用、チェックリスト |
| `--color-text-desc` | `#4c5d59` | 説明文 |
| `--color-text-muted` | `#526460` | 補助テキスト |
| `--color-text-photo` | `#5d6d69` | 写真エリア |
| `--color-text-subtle` | `#63736f` | ヒント |
| `--color-text-placeholder` | `#82918c` | プレースホルダー |

#### 背景

| 変数 | 既定値 | 用途 |
|------|--------|------|
| `--color-bg-page` | `#f3f5f1` | ページ全体の背景 |
| `--color-bg-surface` | `#fff` | カード、入力欄 |
| `--color-bg-alt` | `#f6f8f5` | 読み取り専用入力 |
| `--color-bg-soft` | `#f8faf7` | 郵便番号欄、写真エリア |
| `--color-bg-field` | `#f8fbf9` | フィールドガイダンス |
| `--color-bg-dialog` | `#eef2ec` | ダイアログ本体 |

#### ボーダー

| 変数 | 既定値 | 用途 |
|------|--------|------|
| `--color-border` | `#d7ddd5` | カード・セクション区切り |
| `--color-border-light` | `#e3e8e1` | ヘッダー下線 |
| `--color-border-input` | `#b8c5c0` | 入力欄の枠線 |
| `--color-border-guidance` | `#d7e3dd` | フィールドガイダンス枠 |
| `--color-guidance-border` | `#c9dbd3` | セクションガイダンス枠 |
| `--color-guidance-accent` | `#6a9387` | ガイダンス左線 |

#### ステータス

| 変数 | 既定値 | 用途 |
|------|--------|------|
| `--color-notice-bg` | `#e8f0ec` | 成功・完了の背景 |
| `--color-notice-border` | `#a9c6bb` | 成功・完了の枠線 |
| `--color-danger` | `#a94734` | エラー・削除ボタン |
| `--color-danger-dark` | `#823923` | エラーテキスト |
| `--color-warning-bg` | `#fff2ea` | 警告の背景 |
| `--color-warning-border` | `#d9a68f` | 警告の枠線 |

#### フォント

| 変数 | 用途 |
|------|------|
| `--font-ui` | 画面UIのフォント |
| `--font-pdf-gothic` | PDF出力ゴシック体 |
| `--font-pdf-mincho` | PDF出力明朝体 |

#### 角丸・影

| 変数 | 既定値 | 用途 |
|------|--------|------|
| `--radius-card` | `8px` | カード・ボタン・入力欄の角丸 |
| `--shadow-card` | `0 2px 10px rgba(...)` | カードの影 |
| `--shadow-dialog` | `0 16px 40px rgba(...)` | ダイアログの影 |
| `--shadow-preview` | `0 4px 16px rgba(...)` | PDFプレビューの影 |
| `--backdrop-color` | `rgba(36,48,47,.35)` | ダイアログ背景幕 |

### JS定数一覧

#### `src/lib/config.ts`

| 定数 | 値 | 用途 |
|------|-----|------|
| `JPEG_QUALITY` | `0.92` | 写真・PDF出力のJPEG圧縮品質 |
| `PHOTO_OUTPUT_WIDTH` | `900` | 写真出力の幅（px） |
| `PHOTO_OUTPUT_HEIGHT` | `1200` | 写真出力の高さ（px） |
| `PHOTO_ASPECT_RATIO` | `3/4` | 写真のアスペクト比 |
| `PHOTO_MAX_FILE_SIZE_MB` | `10` | 写真の最大ファイルサイズ（MB） |

#### `src/browser/pdfRenderer.ts`

| 定数 | 値 | 用途 |
|------|-----|------|
| `PDF_CANVAS_SCALE` | `3` | html2canvasのスケール倍率（高精細度） |

#### `src/lib/printPagination.ts`（ページ分割）

| 定数 | 値 | 用途 |
|------|-----|------|
| `RESUME_PAGE_CAPACITY_UNITS` | `232` | 履歴書1ページの容量 |
| `ACCOMMODATION_PAGE_CAPACITY_UNITS` | `254` | 配慮事項シート1ページの容量 |
| `RESUME_PROFILE_UNITS` | `86` | プロフィール欄の高さ |
| `RESUME_TABLE_HEADER_UNITS` | `13` | テーブルヘッダーの高さ |
| `RESUME_TABLE_ROW_MIN_UNITS` | `7` | テーブル行の最小高さ |
| `RESUME_TEXT_MIN_UNITS` | `28` | テキストボックスの最小高さ |
| `RESUME_MINI_UNITS` | `28` | ミニグリッドの高さ |

#### `src/components/PdfPages.tsx`（固定レイアウト）

| 定数 | A4 | A3 | 用途 |
|------|-----|-----|------|
| `primaryRows` | `21` | `22` | 1ページ目（左カラム）の最大行数 |
| `primaryMin` | `21` | `22` | 1ページ目の最小空行数 |
| `secondaryMin` | `5` | `7` | 2ページ目（右カラム）の最小空行数 |
| `qualBlanks` | `5` | `3` | 免許・資格テーブルの空行数 |

#### `vite.config.ts`（PWA設定）

| 設定 | 値 | 用途 |
|------|-----|------|
| `registerType` | `'prompt'` | 更新時にユーザーに確認してからリロード |
| `manifest.name` | `'履歴書作成ツール'` | インストール画面に表示されるアプリ名 |
| `manifest.short_name` | `'履歴書作成'` | ホーム画面のアイコン下に表示される短縮名 |
| `manifest.theme_color` | `'#2f5d50'` | ブラウザのアドレスバー・スプラッシュ画面の色 |
| `manifest.background_color` | `'#f3f5f1'` | スプラッシュ画面の背景色 |
| `manifest.display` | `'standalone'` | アドレスバーなしのアプリ風表示 |
| `workbox.globPatterns` | `js/css/html/md/画像/フォント` | アプリとマニュアル全章をオフラインキャッシュ |
| `workbox.navigateFallbackDenylist` | `[/\/manual\//]` | ルート・サブディレクトリ配備ともマニュアルをSPAフォールバック対象外にする |
