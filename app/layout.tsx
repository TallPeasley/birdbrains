import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { RoleProvider } from '@/lib/roleContext';
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
      <body className="min-h-screen font-sans">
        <RoleProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">{children}</main>
          <CaptureFab />
          <CaptureModal />
        </RoleProvider>
      </body>
    </html>
  );
}
