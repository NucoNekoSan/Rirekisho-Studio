import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalPage } from './LegalPage';

describe('LegalPage', () => {
  it('explains the privacy boundary and official contact route', () => {
    render(<MemoryRouter><LegalPage kind="privacy" /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'プライバシーポリシー' })).toBeInTheDocument();
    expect(screen.getByText(/利用者が有効にした場合だけ/)).toBeInTheDocument();
    expect(screen.getByText(/7桁の数字をzipcloudへ送信/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /お問い合わせフォーム/ })).toHaveAttribute('href', 'https://nuconeko-garden.com/contact/?work=rirekisho-studio');
  });

  it('publishes the service terms and contact route', () => {
    render(<MemoryRouter><LegalPage kind="terms" /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '利用規約' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /お問い合わせフォーム/ })).toHaveAttribute('href', 'https://nuconeko-garden.com/contact/?work=rirekisho-studio');
  });
});
