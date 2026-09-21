import React from 'react';
import QRScanner from '@/components/QRScanner/ScannerModal';
import Link from 'next/link';
import { BarChart3, Megaphone, Zap } from 'lucide-react';

export default function ScannerPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto px-3 sm:px-6 py-3 sm:py-6 w-full flex flex-col items-center">
      {/* QR Scanner Module */}
      <QRScanner />
    </main>
  );
}
