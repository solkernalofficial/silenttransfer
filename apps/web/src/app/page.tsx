import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'SilentTransfer — Send crypto privately without KYC',
  description:
    'Private transfers on public blockchains. One-time destinations, recipient claim, no identity gates. Protocol asset SILENT (1B hard cap).',
};

export default function HomePage() {
  return <LandingPage />;
}
