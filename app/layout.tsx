import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NIRMAAN-PASS — Digital Participant Pass & Event Operations',
  description: 'Digital Participant Pass, Attendance, Meal Serving & Event Operations System for NIRMAAN 2026',
  icons: {
    icon: [
      { url: '/assets/favicon.ico' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/assets/favicon.ico',
    apple: '/assets/favicon.ico',
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
