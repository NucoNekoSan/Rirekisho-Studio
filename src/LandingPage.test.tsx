import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('introduces the product, privacy boundary, and editor route', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /履歴書を/ })).toBeInTheDocument();
    expect(screen.getByText(/個人情報はCloudflareや運営者のサーバーへ保存しません/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '履歴書を作成する' })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: '使い方を見る' })).toHaveAttribute('href', '/manual/');
    expect(screen.queryByRole('link', { name: /GitHub|ソースコード/ })).not.toBeInTheDocument();
  });
});
