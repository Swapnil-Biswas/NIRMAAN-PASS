'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Camera, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Shield, Utensils, Sun, Moon, Coffee } from 'lucide-react';
import { ScanPurpose, Team, Member, ScanResult, MealType } from '@/types/database';
import { sanitizeQRToken } from '@/lib/qr/token';
import RegistrationModal from '@/components/Admin/RegistrationModal';
import MealServeModal from '@/components/Admin/MealServeModal';
import CoffeeServeModal from '@/components/Admin/CoffeeServeModal';

export default function QRScanner() {
  const [purpose, setPurpose] = useState<ScanPurpose>('lunch');
  const [manualToken, setManualToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);

  // Scanned team context
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [scannedTeam, setScannedTeam] = useState<Team | null>(null);
  const [scannedMembers, setScannedMembers] = useState<Member[]>([]);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Scanner camera ref
  const html5QrCodeRef = useRef<any>(null);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      setScanning(true);
      const { Html5Qrcode } = await import('html5-qrcode');
      
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {}
      }

      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleTokenScanned(decodedText);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
    } catch (err: any) {
      console.warn('Camera failed to start:', err);
      setScanning(false);
      setErrorMsg('Camera access unavailable. You can use manual token or test presets below.');
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleTokenScanned = async (tokenInput: string) => {
    const token = sanitizeQRToken(tokenInput);
    if (!token) {
      setErrorMsg('Invalid QR token payload.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    setActiveToken(token);

    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: token, action: 'lookup' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Invalid QR — Team not found.');
        setActiveToken(null);
        setScannedTeam(null);
        setScannedMembers([]);
        return;
      }

      setScannedTeam(data.team);
      setScannedMembers(data.members || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while validating QR');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRegistration = async (presentMemberIds: string[]) => {
    if (!activeToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: activeToken,
          purpose: 'registration',
          present_member_ids: presentMemberIds,
        }),
      });

      const data: ScanResult = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        closeModals();
        autoResetAfterSuccess();
      } else {
        setErrorMsg(data.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error completing registration');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMeal = async () => {
    if (!activeToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: activeToken,
          purpose,
        }),
      });

      const data: ScanResult = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        closeModals();
        autoResetAfterSuccess();
      } else {
        setErrorMsg(data.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error serving meal');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCoffee = async () => {
    if (!activeToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: activeToken,
          purpose: 'coffee',
        }),
      });

      const data: ScanResult = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        closeModals();
        autoResetAfterSuccess();
      } else {
        setErrorMsg(data.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error serving coffee');
    } finally {
      setLoading(false);
    }
  };

  const closeModals = () => {
    setScannedTeam(null);
    setScannedMembers([]);
    setActiveToken(null);
  };

  const autoResetAfterSuccess = () => {
    // Reset scanner after 3 seconds so volunteer is ready for next participant
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3500);
  };

  const getPurposeTheme = () => {
    switch (purpose) {
      case 'registration':
        return { label: 'On-Desk Registration', bg: 'bg-nirmaan-amber', text: 'text-nirmaan-black', icon: Shield };
      case 'breakfast':
        return { label: 'Breakfast Serving', bg: 'bg-nirmaan-amber', text: 'text-nirmaan-black', icon: Sun };
      case 'lunch':
        return { label: 'Lunch Serving', bg: 'bg-nirmaan-orange', text: 'text-white', icon: Utensils };
      case 'dinner':
        return { label: 'Dinner Serving', bg: 'bg-nirmaan-purple', text: 'text-white', icon: Moon };
      case 'coffee':
        return { label: 'Coffee / Tea', bg: 'bg-nirmaan-blue', text: 'text-white', icon: Coffee };
    }
  };

  const currentTheme = getPurposeTheme();
  const CurrentIcon = currentTheme.icon;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Purpose Selector Box */}
      <div className="nirmaan-card p-6 border-2 border-nirmaan-black bg-nirmaan-cream-card">
        <label className="block text-xs font-bold uppercase tracking-widest text-nirmaan-black/70 mb-2">
          SELECT SCAN PURPOSE
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(
            [
              { id: 'registration', label: 'Registration' },
              { id: 'breakfast', label: 'Breakfast' },
              { id: 'lunch', label: 'Lunch' },
              { id: 'dinner', label: 'Dinner' },
              { id: 'coffee', label: 'Coffee / Tea' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setPurpose(item.id);
                setErrorMsg(null);
              }}
              className={`nirmaan-pill py-3 justify-center text-xs font-black transition-all ${
                purpose === item.id
                  ? 'bg-nirmaan-black text-white shadow-md scale-102'
                  : 'bg-white hover:bg-nirmaan-cream text-nirmaan-black border border-nirmaan-black/15'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Current Active Mode Banner */}
        <div className={`mt-4 p-3.5 rounded-xl ${currentTheme.bg} ${currentTheme.text} flex items-center justify-between shadow-sm`}>
          <div className="flex items-center gap-2">
            <CurrentIcon className="w-5 h-5" />
            <span className="font-display font-bold text-sm tracking-wide uppercase">
              MODE: {currentTheme.label}
            </span>
          </div>
          <span className="text-[11px] font-extrabold uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
            READY TO SCAN
          </span>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="bg-nirmaan-green-bright border-2 border-nirmaan-black p-4 rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-nirmaan-black stroke-[2.5]" />
            <div>
              <p className="font-display font-black text-sm text-nirmaan-black uppercase">
                OPERATION CONFIRMED
              </p>
              <p className="text-xs font-bold text-nirmaan-black/80">{successMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-xs font-bold bg-nirmaan-black text-white px-3 py-1.5 rounded-full hover:bg-nirmaan-black/80"
          >
            NEXT SCAN
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-nirmaan-red text-white p-4 rounded-2xl flex items-start gap-3 shadow-lg animate-in slide-in-from-top duration-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-display font-black text-sm uppercase">SCAN REJECTED</p>
            <p className="text-xs font-medium text-white/90">{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-xs font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Camera & Scanner Viewport */}
      <div className="nirmaan-card p-6 border-2 border-nirmaan-black bg-white flex flex-col items-center justify-center text-center">
        <div id="qr-reader" className="w-full max-w-sm rounded-xl overflow-hidden mb-4 min-h-[50px]"></div>

        {scanning ? (
          <button
            onClick={stopCamera}
            className="nirmaan-btn nirmaan-btn-outline text-xs py-3 w-full max-w-xs font-bold"
          >
            STOP CAMERA
          </button>
        ) : (
          <button
            onClick={startCamera}
            disabled={loading}
            className="nirmaan-btn nirmaan-btn-primary text-xs py-3.5 w-full max-w-xs font-black shadow-md"
          >
            <Camera className="w-4 h-4" />
            START CAMERA SCANNER
          </button>
        )}
      </div>

      {/* Instant Manual Token Input & Test Presets */}
      <div className="nirmaan-card p-6 border border-nirmaan-black/15 bg-nirmaan-cream-card">
        <h3 className="font-display text-sm font-bold uppercase text-nirmaan-black mb-3">
          INSTANT TOKEN LOOKUP / TEST PRESETS
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualToken.trim()) handleTokenScanned(manualToken);
          }}
          className="flex gap-2 mb-4"
        >
          <input
            type="text"
            placeholder="Enter token (e.g. nirmaan_alpha_9281a)"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-full border-2 border-nirmaan-black/20 focus:border-nirmaan-black outline-none font-mono text-xs"
          />
          <button
            type="submit"
            disabled={loading || !manualToken.trim()}
            className="nirmaan-btn nirmaan-btn-dark text-xs px-5 py-2.5 font-bold"
          >
            {loading ? 'LOOKUP...' : 'SCAN'}
          </button>
        </form>

        {/* Quick Test Presets */}
        <div>
          <p className="text-[11px] font-bold uppercase text-nirmaan-black/50 mb-2">
            Click to test with pre-seeded teams:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTokenScanned('nirmaan_alpha_9281a')}
              className="nirmaan-pill bg-white hover:bg-nirmaan-cream text-nirmaan-black border border-nirmaan-black/15 text-[11px]"
            >
              Alpha (Checked In, 3 Present)
            </button>
            <button
              onClick={() => handleTokenScanned('nirmaan_beta_4812b')}
              className="nirmaan-pill bg-white hover:bg-nirmaan-cream text-nirmaan-black border border-nirmaan-black/15 text-[11px]"
            >
              Beta (Unregistered)
            </button>
            <button
              onClick={() => handleTokenScanned('nirmaan_gamma_7723c')}
              className="nirmaan-pill bg-white hover:bg-nirmaan-cream text-nirmaan-black border border-nirmaan-black/15 text-[11px]"
            >
              Gamma (Full Meals)
            </button>
          </div>
        </div>
      </div>

      {/* Render Popups based on purpose and scanned team */}
      {scannedTeam && purpose === 'registration' && (
        <RegistrationModal
          team={scannedTeam}
          members={scannedMembers}
          onConfirm={handleConfirmRegistration}
          onCancel={closeModals}
          loading={loading}
        />
      )}

      {scannedTeam && (purpose === 'breakfast' || purpose === 'lunch' || purpose === 'dinner') && (
        <MealServeModal
          team={scannedTeam}
          members={scannedMembers}
          mealType={purpose as MealType}
          onConfirmServe={handleConfirmMeal}
          onCancel={closeModals}
          loading={loading}
        />
      )}

      {scannedTeam && purpose === 'coffee' && (
        <CoffeeServeModal
          team={scannedTeam}
          onConfirmServe={handleConfirmCoffee}
          onCancel={closeModals}
          loading={loading}
        />
      )}
    </div>
  );
}
