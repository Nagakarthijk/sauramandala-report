import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TFFP Platform',
  description:
    'A production tracker for contextual children\'s literature — from field recording to published book.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
