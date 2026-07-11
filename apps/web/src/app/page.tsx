import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'SilentTransfer — Private transfers harder to trace',
  description:
    'Private vault payouts on public blockchains. Deposit, then send single or batch anytime. Recipients receive automatically. Protocol asset SILENT (1B hard cap).',
};

export default function HomePage() {
  return <LandingPage />;
}
