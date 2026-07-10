import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';
import WalletExtensionGuard from '@/components/WalletExtensionGuard';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://silenttransfer.com'
  ),
  title: {
    default: 'SilentTransfer — Send crypto privately without KYC',
    template: '%s · SilentTransfer',
  },
  description:
    'Private transfers on public blockchains. One-time destinations, recipient claim, no identity gates. Protocol asset: SILENT (1B hard cap).',
  icons: {
    icon: '/brand/logo.svg',
    apple: '/brand/logo.svg',
  },
  openGraph: {
    title: 'SilentTransfer — Private transfers without KYC',
    description:
      'One-time destinations and recipient claim on public chains. No identity gates. Protocol asset: SILENT.',
    images: [{ url: '/brand/hero-bg.jpg', width: 1280, height: 720 }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased rh-page`}>
        {/* Runs before app hydrates — blocks Phantom/MetaMask ethereum race from bricking UI */}
        <Script src="/suppress-wallet-errors.js" strategy="beforeInteractive" />
        <WalletExtensionGuard />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
