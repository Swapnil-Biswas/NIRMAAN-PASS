import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NIRMAAN-PASS — Digital Participant Pass & Event Operations',
  description: 'Digital Participant Pass, Attendance, Meal Serving & Event Operations System for NIRMAAN 2026',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-nirmaan-cream text-nirmaan-black selection:bg-nirmaan-amber selection:text-nirmaan-black">
        {children}
      </body>
    </html>
  );
}
