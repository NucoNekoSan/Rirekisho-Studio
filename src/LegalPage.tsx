import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

type LegalPageKind = 'privacy' | 'terms';

const contactUrl = 'https://nuconeko-garden.com/contact/?work=rirekisho-studio';

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const isPrivacy = kind === 'privacy';
  const title = isPrivacy ? 'プライバシーポリシー' : '利用規約';

  useEffect(() => {
    document.title = `${title} | Rirekisho Studio`;
    return () => { document.title = 'Rirekisho Studio｜無料の履歴書作成アプリ'; };
  }, [title]);

  return (
    <div className="legal-shell">
      <a className="skip-link" href="#legal-content">本文へスキップ</a>
      <header className="legal-header">
        <Link className="landing-brand" to="/">Rirekisho Studio</Link>
        <nav aria-label="関連ページ">
          <Link to="/app">履歴書を作成</Link>
          <Link to="/privacy">プライバシー</Link>
          <Link to="/terms">利用規約</Link>
        </nav>
      </header>
      <main id="legal-content" className="legal-content" tabIndex={-1}>
        <p className="landing-eyebrow">RIREKISHO STUDIO</p>
        <h1>{title}</h1>
        <p className="legal-updated">制定日・最終更新日：2026年9月25日</p>
        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </main>
      <footer className="legal-footer">
        <Link to="/">トップへ戻る</Link>
        <a href={contactUrl}>お問い合わせ</a>
      </footer>
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <section>
        <h2>1. 基本方針</h2>
        <p>Rirekisho Studioは、履歴書に含まれる個人情報を利用者自身の管理下で扱う、ローカルファーストのWebアプリです。入力内容を運営者のサーバーへ保存する機能や、アカウント登録機能はありません。</p>
      </section>
      <section>
        <h2>2. 端末内で扱う情報</h2>
        <p>氏名、住所、連絡先、生年月日、学歴・職歴、写真、自由記述、配慮事項はブラウザ内で処理されます。初期状態ではメモリだけに保持され、画面を閉じるか再読み込みすると失われます。</p>
        <p>「この端末に保存する」を利用者が有効にした場合だけ、入力内容をブラウザのIndexedDBへ保存します。保存同意の選択だけはlocalStorageへ保存します。sessionStorageは使用しません。</p>
      </section>
      <section>
        <h2>3. 外部通信</h2>
        <p>住所検索を利用した場合に限り、入力された郵便番号を正規化した7桁の数字をzipcloudへ送信します。氏名、住所、電話番号、写真、履歴書本文、配慮事項は送信しません。アクセス時には、静的ファイル配信に必要な範囲でCloudflareにアクセス情報が記録される場合があります。</p>
      </section>
      <section>
        <h2>4. ファイルと削除</h2>
        <p>PDF・Word・Excel・JSONは利用者の操作で端末へ保存され、保存後は本アプリの管理外となります。これらのファイルは暗号化されていないため、安全な場所で管理してください。写真は既定ではJSONに含まれません。</p>
        <p>端末内の履歴書はアプリの削除操作、またはブラウザのサイトデータ削除で消去できます。共有端末では端末保存を有効にせず、ダウンロードしたファイルも利用後に削除してください。</p>
      </section>
      <section>
        <h2>5. お問い合わせ</h2>
        <p><a href={contactUrl}>ぬこねこの庭のお問い合わせフォーム</a>からご連絡ください。履歴書やJSONなどの個人情報を添付・貼付しないでください。</p>
      </section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <section>
        <h2>1. サービスの目的</h2>
        <p>本サービスは、日本向け履歴書の作成、確認、PDF・Word・Excel出力を補助する無料ツールです。就職・採用・内定を保証するものではなく、職業紹介、添削、医療または法律上の助言を提供するものではありません。</p>
      </section>
      <section>
        <h2>2. 利用者の責任</h2>
        <p>入力内容と提出書類の正確性、応募先の指定様式への適合、第三者情報を入力する場合の権限は、利用者が確認してください。配慮事項には、応募先へ共有してよい情報だけを入力してください。</p>
      </section>
      <section>
        <h2>3. データ管理</h2>
        <p>本サービスは入力内容を運営者のサーバーへ保存しません。端末故障、ブラウザデータの削除、操作ミスなどに備え、必要なデータは利用者自身でJSONやPDFとしてバックアップしてください。</p>
      </section>
      <section>
        <h2>4. 禁止事項</h2>
        <p>法令または公序良俗に反する利用、他者の権利を侵害する利用、サービスの運営や安全性を妨げる行為を禁止します。</p>
      </section>
      <section>
        <h2>5. 提供の変更・免責</h2>
        <p>運営者は、保守や改善のため予告なく機能を変更または提供を停止する場合があります。故意または重大な過失がある場合を除き、本サービスの利用または利用不能から生じた損害について責任を負いません。</p>
      </section>
      <section>
        <h2>6. お問い合わせ</h2>
        <p>サービスに関するお問い合わせは、<a href={contactUrl}>ぬこねこの庭のお問い合わせフォーム</a>からご連絡ください。</p>
      </section>
    </>
  );
}
