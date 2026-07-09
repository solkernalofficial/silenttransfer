import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'SilentTransfer — Private transfer infrastructure',
  description:
    'SilentTransfer: private receive, transfer, discovery, and settlement. No KYC. Protocol asset SILENT (1B hard cap).',
};

export default function HomePage() {
  return <LandingPage />;
}
