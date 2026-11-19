import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import 'katex/dist/katex.min.css'; // fonts for MathText, served from our own site
import './globals.css';
import { RoleProvider } from '@/lib/roleContext';
import { SessionProvider } from '@/lib/session';
import Navbar from '@/components/Navbar';
import CaptureFab from '@/components/CaptureFab';
import CaptureModal from '@/components/CaptureModal';
import PwaSetup from '@/components/PwaSetup';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BirdBrains',
  description: 'Four-pillar math diagnostics for students and parents.',
  applicationName: 'BirdBrains',
  // Installed-app look on iPhone/iPad ("Add to Home Screen"); app/manifest.ts covers Android and desktop.
  appleWebApp: { capable: true, title: 'BirdBrains', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <SessionProvider>
        <RoleProvider>
          <Navbar />
          <PwaSetup />
          <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">{children}</main>
          <CaptureFab />
          <CaptureModal />
        </RoleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
