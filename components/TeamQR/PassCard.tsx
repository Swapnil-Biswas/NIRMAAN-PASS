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
      // White background with border
      ctx.fillStyle = '#FFFFFF';
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
        const logoSize = Math.round(800 * (52 / 220));
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
          {team.track && (
            <p className="text-xs font-bold text-nirmaan-blue mt-1">{team.track}</p>
          )}
          {members.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-bold uppercase bg-nirmaan-black/5 px-2.5 py-1 rounded-full text-nirmaan-black">
                Members: {team.checked_in ? `${presentCount}/${members.length} Present` : `${members.length} Registered`}
              </span>
            </div>
          )}
        </div>

        {/* Status Check: Pending Approval / Rejected vs Approved */}
        {team.review_status === 'pending' || team.review_status === 'flagged_duplicate' ? (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-inner border-2 border-dashed border-nirmaan-amber flex flex-col items-center justify-center text-center mb-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-nirmaan-amber/20 border-2 border-nirmaan-amber flex items-center justify-center text-nirmaan-black animate-pulse">
              <AlertTriangle className="w-8 h-8 text-nirmaan-amber" />
            </div>

            <div className="space-y-1.5 max-w-sm">
              <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[10px] font-black uppercase">
                AWAITING ORGANIZER APPROVAL
              </span>
              <h3 className="font-display text-lg font-black uppercase text-nirmaan-black pt-1">
                REGISTRATION UNDER REVIEW
              </h3>
              <p className="text-xs font-semibold text-nirmaan-black/70 leading-relaxed">
                Your team registration is currently being verified by the NIRMAAN 2026 Organizing Committee.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-nirmaan-cream/60 border border-nirmaan-black/10 text-left w-full space-y-1">
              <p className="text-[11px] font-black uppercase text-nirmaan-black flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-nirmaan-blue" />
                ON-DESK REGISTRATION PASS
              </p>
              <p className="text-[11px] text-nirmaan-black/70 leading-normal">
                Once approved, your official <strong>Digital QR Pass</strong> will be unlocked here. You must present that QR Pass at the venue desk on event day for physical registration & food coupons.
              </p>
            </div>
          </div>
        ) : team.review_status === 'rejected' || team.review_status === 'merged' ? (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-nirmaan-red/30 flex flex-col items-center justify-center text-center mb-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-nirmaan-red/10 border border-nirmaan-red/30 flex items-center justify-center text-nirmaan-red">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="font-display text-base font-black uppercase text-nirmaan-red">
              {team.review_status === 'merged' ? 'DUPLICATE TEAM MERGED' : 'REGISTRATION REJECTED'}
            </h3>
            <p className="text-xs font-medium text-nirmaan-black/70 max-w-xs">
              {team.duplicate_notes || 'This registration is inactive. Please contact the NIRMAAN help desk for assistance.'}
            </p>
          </div>
        ) : (
          <>
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
                  imageSettings={{
                    src: NIRMAAN_QR_LOGO,
                    height: 52,
                    width: 52,
                    excavate: true,
                  }}
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
                Show this official QR Pass on event day at the venue desk for on-desk registration, check-in, and meals.
              </p>
            </div>

            {/* Action Buttons: Save & Share */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleDownload}
                className="nirmaan-btn nirmaan-btn-dark text-xs py-3 w-full font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                title="Download Official QR Pass PNG"
              >
                <Download className="w-4 h-4 text-nirmaan-amber" />
                <span>SAVE / DOWNLOAD PASS</span>
              </button>

              <button
                onClick={handleShare}
                className="nirmaan-btn nirmaan-btn-primary text-xs py-3 w-full font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                title="Share Official Event Pass Link"
              >
                {copied || shared ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>PASS COPIED!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>SHARE EVENT PASS</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
