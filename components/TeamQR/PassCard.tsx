'use client';

import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2, Check, Copy, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Team, Member } from '@/types/database';
import { formatQRPayload } from '@/lib/qr/token';
import { NIRMAAN_QR_LOGO } from '@/lib/brand/qrLogo';

interface PassCardProps {
  team: Team;
  members?: Member[];
}

export default function PassCard({ team, members = [] }: PassCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const qrPayload = formatQRPayload(team.qr_token);
  const presentCount = members.filter((m) => m.present).length;

  const handleDownload = () => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // Create high-res canvas
    canvas.width = 1000;
    canvas.height = 1000;

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    img.onload = () => {
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        return;
      }
      // Website background color (#F1EBDD)
      ctx.fillStyle = '#F1EBDD';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 100, 100, 800, 800);

      // Explicitly overlay the high-res emblem in center to ensure crystal-clear export
      const logoImg = new Image();
      const saveFile = () => {
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `${team.team_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_nirmaan_pass.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        URL.revokeObjectURL(blobUrl);
      };

      logoImg.onload = () => {
        const logoSize = Math.round(800 * (66 / 240));
        const logoOffset = 500 - Math.round(logoSize / 2);
        ctx.drawImage(logoImg, logoOffset, logoOffset, logoSize, logoSize);
        saveFile();
      };
      logoImg.onerror = saveFile;
      logoImg.src = NIRMAAN_QR_LOGO;
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
    };

    img.src = blobUrl;
  };

  const handleShare = async () => {
    const shareText = `NIRMAAN 2026 Digital Pass for ${team.team_name}\nShow this QR at On-Desk Registration and all Food/Coffee counters.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `NIRMAAN 2026 Pass - ${team.team_name}`,
          text: shareText,
          url: window.location.href,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('QR Pass Link copied: ' + window.location.href);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Pass Card Container */}
      <div className="nirmaan-card p-4 sm:p-8 bg-nirmaan-cream-card relative overflow-hidden border-2 border-nirmaan-black">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <div className="flex items-center gap-1.5 font-display text-xl sm:text-2xl font-black uppercase text-nirmaan-black">
              nirmaan<span className="text-nirmaan-red text-2xl sm:text-3xl leading-none">.</span>
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-nirmaan-black/60 mt-0.5">
              OFFICIAL PARTICIPANT PASS
            </p>
          </div>

          {/* Checked-in status badge */}
          {team.checked_in ? (
            <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black font-extrabold text-[11px] sm:text-xs shadow-sm flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              CHECKED IN
            </span>
          ) : (
            <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black font-extrabold text-[11px] sm:text-xs shadow-sm flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
              DESK REG REQ
            </span>
          )}
        </div>

        {/* Team Details */}
        <div className="mb-5 sm:mb-6 pb-5 sm:pb-6 border-b border-nirmaan-black/10">
          <h2 className="font-display text-xl sm:text-3xl font-black uppercase leading-tight text-nirmaan-black mb-1 break-words">
            {team.team_name}
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/70">
            {team.college}
          </p>
          {members.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase bg-nirmaan-black/5 px-2.5 py-1 rounded-full text-nirmaan-black">
                Members: {team.checked_in ? `${presentCount}/${members.length} Present` : `${members.length} Registered`}
              </span>
            </div>
          )}
        </div>

        {/* Enhanced QR Code Presentation Box */}
            <div className="bg-nirmaan-cream p-4 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border-2 border-nirmaan-black/15 flex flex-col items-center justify-center mb-5 sm:mb-6">
              <div className="flex items-center gap-1.5 mb-3.5 sm:mb-4 text-[10px] font-black uppercase tracking-wider text-nirmaan-black/70 bg-white px-3 sm:px-3.5 py-1 rounded-full border border-nirmaan-black/10 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-nirmaan-green-bright animate-pulse" />
                <span>OFFICIAL DIGITAL PASS</span>
              </div>

              <div ref={qrRef} className="p-2.5 sm:p-4 bg-nirmaan-cream rounded-xl sm:rounded-2xl border-2 border-nirmaan-black/20 shadow-sm flex items-center justify-center max-w-full">
                <QRCodeSVG
                  value={qrPayload}
                  size={200}
                  level="H"
                  includeMargin={false}
                  fgColor="#141414"
                  bgColor="#F1EBDD"
                  className="w-[170px] h-[170px] xs:w-[200px] xs:h-[200px] sm:w-[240px] sm:h-[240px] max-w-full"
                  imageSettings={{
                    src: NIRMAAN_QR_LOGO,
                    height: 52,
                    width: 52,
                    excavate: true,
                  }}
                />
              </div>

              <p className="text-[10px] sm:text-[11px] font-bold text-nirmaan-black/60 mt-3 sm:mt-4 tracking-wide uppercase text-center">
                Scan for On-Desk Registration &amp; Meals
              </p>
            </div>

            {/* Mandatory Participant Instruction Banner */}
            <div className="bg-nirmaan-amber/20 border-l-4 border-nirmaan-amber p-3 sm:p-3.5 rounded-r-xl mb-5 sm:mb-6">
              <p className="text-xs font-semibold text-nirmaan-black leading-relaxed">
                <strong className="uppercase font-bold block mb-0.5">Important:</strong>
                Show this official QR Pass on event day at the venue desk for on-desk registration, check-in, and meals.
              </p>
            </div>

            {/* Action Buttons: Save & Share */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <button
                onClick={handleDownload}
                className="nirmaan-btn nirmaan-btn-dark text-xs py-3 w-full font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                title="Download Official QR Pass PNG"
              >
                <Download className="w-4 h-4 text-nirmaan-amber flex-shrink-0" />
                <span className="sm:hidden">SAVE PASS</span>
                <span className="hidden sm:inline">SAVE / DOWNLOAD PASS</span>
              </button>

              <button
                onClick={handleShare}
                className="nirmaan-btn nirmaan-btn-primary text-xs py-3 w-full font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                title="Share Official Event Pass Link"
              >
                {copied || shared ? (
                  <>
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    <span>PASS COPIED!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 flex-shrink-0" />
                    <span className="sm:hidden">SHARE PASS</span>
                    <span className="hidden sm:inline">SHARE EVENT PASS</span>
                  </>
                )}
              </button>
            </div>
      </div>
    </div>
  );
}
