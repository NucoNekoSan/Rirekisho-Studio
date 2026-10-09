# 静的アセット台帳

最終確認日: 2026-09-28

| アセット | 由来 | 用途 |
|---|---|---|
| `public/favicon.svg` | Rirekisho Studio用に独自制作した履歴書の図案（外部素材・フォント不使用） | ブラウザアイコン |
| `public/favicon.ico` | faviconから生成した配布物 | 互換ブラウザ用アイコン |
| `public/pwa-64x64.png` | faviconから生成した配布物 | PWAアイコン |
| `public/pwa-192x192.png` | faviconから生成した配布物 | PWAアイコン |
| `public/pwa-512x512.png` | faviconから生成した配布物 | PWAアイコン |
| `public/maskable-icon-512x512.png` | faviconから生成した配布物 | PWAマスカブルアイコン |
| `public/apple-touch-icon-180x180.png` | faviconから生成した配布物 | Apple touch icon |

出典と利用実績を確認できなかった未使用のSNSアイコン集 `public/icons.svg` は、一般公開版から除外した。

配布用アイコンは `node scripts/generate-icons.mjs` でSVGから再生成する。ICOは16・32・48pxを収録し、マスカブル版は前景を中央の安全領域に収め、Apple touch版は不透明な背景を全面に敷く。
