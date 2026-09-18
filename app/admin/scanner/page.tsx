import React from 'react';
import Navbar from '@/components/Navbar';
import QRScanner from '@/components/QRScanner/ScannerModal';
import Link from 'next/link';
import { ArrowLeft, Shield, BarChart3, Megaphone, Zap } from 'lucide-react';

export default function ScannerPage() {
  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full">
        {/* Top Control Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="nirmaan-pill bg-nirmaan-red text-white text-[10px] font-black">
                <Zap className="w-3 h-3" />
                EVENT OPERATIONS DESK
              </span>
              <span className="text-xs font-bold uppercase text-nirmaan-black/60">
                HIGH-SPEED QUEUE SCANNER
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-nirmaan-black">
              QR SCANNER
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="nirmaan-pill bg-white text-nirmaan-black border border-nirmaan-black/20 hover:bg-nirmaan-cream text-xs font-bold shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Event Stats
            </Link>
            <Link
              href="/admin/announcements"
              className="nirmaan-pill bg-white text-nirmaan-black border border-nirmaan-black/20 hover:bg-nirmaan-cream text-xs font-bold shadow-xs"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Announcements
            </Link>
          </div>
        </div>

        {/* QR Scanner Module */}
        <QRScanner />
      </main>
    </div>
  );
}
