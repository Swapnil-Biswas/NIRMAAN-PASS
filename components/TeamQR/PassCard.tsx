'use client';

import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2, Check, Copy, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Team, Member } from '@/types/database';
import { formatQRPayload } from '@/lib/qr/token';

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

    img.onload = () => {
      if (!ctx) return;
      // White background with border
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 100, 100, 800, 800);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${team.team_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_nirmaan_pass.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  const handleShare = async () => {
    const shareText = `NIRMAAN 2026 Digital Pass for ${team.team_name}\nQR Token: ${team.qr_token}\nShow this QR at On-Desk Registration and all Food/Coffee counters.`;
    
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
      alert('QR Token copied: ' + team.qr_token);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Pass Card Container */}
      <div className="nirmaan-card p-6 sm:p-8 bg-nirmaan-cream-card relative overflow-hidden border-2 border-nirmaan-black">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-1.5 font-display text-2xl font-black uppercase text-nirmaan-black">
              nirmaan<span className="text-nirmaan-red text-3xl leading-none">.</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-nirmaan-black/60 mt-0.5">
              OFFICIAL PARTICIPANT PASS
            </p>
          </div>

          {/* Checked-in status badge */}
          {team.checked_in ? (
            <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black font-extrabold text-xs shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              CHECKED IN
            </span>
          ) : (
            <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black font-extrabold text-xs shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" />
              DESK REG REQ
            </span>
          )}
        </div>

        {/* Team Details */}
        <div className="mb-6 pb-6 border-b border-nirmaan-black/10">
          <h2 className="font-display text-2xl sm:text-3xl font-black uppercase leading-tight text-nirmaan-black mb-1">
            {team.team_name}
          </h2>
          <p className="text-sm font-semibold text-nirmaan-black/70">
            {team.college}
          </p>
          {members.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-bold uppercase bg-nirmaan-black/5 px-2.5 py-1 rounded-full text-nirmaan-black">
                Members: {team.checked_in ? `${presentCount}/${members.length} Present` : `${members.length} Registered`}
              </span>
            </div>
          )}
        </div>

        {/* QR Code Presentation Box */}
        <div className="bg-white p-6 rounded-2xl shadow-inner border border-nirmaan-black/10 flex flex-col items-center justify-center mb-6">
          <div ref={qrRef} className="p-2 bg-white rounded-xl">
            <QRCodeSVG
              value={qrPayload}
              size={220}
              level="H"
              includeMargin={false}
              fgColor="#141414"
              bgColor="#FFFFFF"
            />
          </div>

          <div className="mt-4 text-center">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-nirmaan-black/60">
              TOKEN ID
            </p>
            <p className="font-mono font-bold text-xs text-nirmaan-black bg-nirmaan-cream px-3 py-1 rounded-md mt-0.5 select-all">
              {team.qr_token}
            </p>
          </div>
        </div>

        {/* Mandatory Participant Instruction Banner */}
        <div className="bg-nirmaan-amber/20 border-l-4 border-nirmaan-amber p-3.5 rounded-r-xl mb-6">
          <p className="text-xs font-semibold text-nirmaan-black leading-relaxed">
            <strong className="uppercase font-bold block mb-0.5">Important:</strong>
            Every team member must show this team QR when collecting meals or beverages. Share this pass with all members.
          </p>
        </div>

        {/* Action Buttons: Save & Share */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            className="nirmaan-btn nirmaan-btn-dark text-xs py-3 w-full font-bold shadow-sm"
          >
            <Download className="w-4 h-4" />
            SAVE QR
          </button>

          <button
            onClick={handleShare}
            className="nirmaan-btn nirmaan-btn-primary text-xs py-3 w-full font-bold shadow-sm"
          >
            {copied || shared ? (
              <>
                <Check className="w-4 h-4" />
                COPIED!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                SHARE QR
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
