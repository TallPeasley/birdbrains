import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import 'katex/dist/katex.min.css'; // fonts for MathText, served from our own site
import './globals.css';
import { RoleProvider } from '@/lib/roleContext';
import { SessionProvider } from '@/lib/session';
import Navbar from '@/components/Navbar';
import CaptureFab from '@/components/CaptureFab';
import CaptureModal from '@/components/CaptureModal';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BirdBrains',
  description: 'Four-pillar math diagnostics for students and parents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen overflow-x-hidden font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        <SessionProvider>
        <RoleProvider>
          <Navbar />
          <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 pb-28 pt-6 outline-none sm:px-6 lg:px-8">{children}</main>
          <CaptureFab />
          <CaptureModal />
        </RoleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
