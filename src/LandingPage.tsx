import { Link } from 'react-router-dom';
import './LandingPage.css';
import { sitePath } from './lib/sitePath';

const features = [
  ['A4・A3 PDF', 'A4縦2ページまたはA3横1枚の履歴書をブラウザ内で生成します。'],
  ['端末内で完結', '入力内容はサーバーへ保存しません。許可した場合だけ、この端末内に保存します。'],
  ['写真と書式', '証明写真の切り抜き、和暦・西暦、明朝・ゴシック、文字揃えに対応します。'],
  ['追加書類', '必要な場合だけ、就労上の配慮事項シートを別紙として作成できます。'],
];

export function LandingPage() {
  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <a className="landing-brand" href="#top">Rirekisho Studio</a>
        <nav aria-label="サービス案内">
          <a href="#features">機能</a>
          <a href="#privacy">プライバシー</a>
          <Link to="/terms">利用規約</Link>
        </nav>
      </header>
      <main id="top">
        <section className="landing-hero">
          <p className="landing-eyebrow">YOUR RESUME, YOUR DEVICE</p>
          <h1>Rirekisho Studioで履歴書を、<br />自分の端末で丁寧につくる。</h1>
          <p className="landing-lead">Rirekisho Studioは、日本向けの履歴書を作成し、A4・A3のPDFとして保存できる無料アプリです。個人情報はCloudflareや運営者のサーバーへ保存しません。</p>
          <div className="landing-actions">
            <Link className="landing-primary" to="/app">履歴書を作成する</Link>
            <a className="landing-secondary" href={sitePath('manual/')}>使い方を見る</a>
          </div>
          <p className="landing-note">アカウント登録不要・ブラウザだけで利用できます</p>
        </section>

        <section id="features" className="landing-section">
          <p className="landing-eyebrow">FEATURES</p>
          <h2>応募書類づくりに必要な機能を、ひとつに。</h2>
          <div className="feature-grid">
            {features.map(([title, body], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="privacy" className="privacy-section">
          <div>
            <p className="landing-eyebrow">PRIVACY BY DESIGN</p>
            <h2>あなたの情報は、あなたの手元に。</h2>
          </div>
          <div>
            <p>入力内容、写真、配慮事項はブラウザ内で処理します。端末への保存は、利用者が明示的に有効化した場合だけ行います。</p>
            <p>外部通信は郵便番号から住所を検索するときだけです。保存用JSONは平文のため、安全な場所で管理してください。</p>
            <p><Link to="/privacy">詳しいプライバシーポリシーを確認する</Link></p>
          </div>
        </section>

        <section className="landing-cta">
          <h2>準備ができたら、はじめましょう。</h2>
          <Link className="landing-primary" to="/app">Rirekisho Studioを開く</Link>
        </section>
      </main>
      <footer className="landing-footer">
        <span>Rirekisho Studio</span>
        <nav aria-label="フッター">
          <Link to="/privacy">プライバシー</Link>
          <Link to="/terms">利用規約</Link>
          <a href="https://nuconeko-garden.com/works/">ぬこねこの庭 Works</a>
        </nav>
      </footer>
    </div>
  );
}
