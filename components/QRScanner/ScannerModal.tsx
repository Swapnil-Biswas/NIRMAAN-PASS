'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Shield,
  Utensils,
  Sun,
  Moon,
  Coffee,
  Plus,
  Award,
  Users,
  Layers,
} from 'lucide-react';
import { ScanPurpose, Team, Member, ScanResult, MealType, ScanEvent, ScanEventRecord } from '@/types/database';
import { sanitizeQRToken } from '@/lib/qr/token';
import RegistrationModal from '@/components/Admin/RegistrationModal';
import MealServeModal from '@/components/Admin/MealServeModal';
import CoffeeServeModal from '@/components/Admin/CoffeeServeModal';
import CustomServeModal from '@/components/Admin/CustomServeModal';
import CustomEventModal from '@/components/Admin/CustomEventModal';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Utensils,
  ShieldCheck: Shield,
  Shield,
  Coffee,
  Award,
  Users,
  Sun,
  Moon,
  Layers,
};

export default function QRScanner() {
  const [purpose, setPurpose] = useState<ScanPurpose>('lunch');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customEvents, setCustomEvents] = useState<ScanEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // Scanned team context
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [scannedTeam, setScannedTeam] = useState<Team | null>(null);
  const [scannedMembers, setScannedMembers] = useState<Member[]>([]);
  const [scannedCustomRecords, setScannedCustomRecords] = useState<ScanEventRecord[]>([]);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Scanner camera ref
  const html5QrCodeRef = useRef<any>(null);

  const fetchCustomEvents = async () => {
    try {
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomEvents(data.events || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchCustomEvents();
  }, []);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      setScanning(true);
      const { Html5Qrcode } = await import('html5-qrcode');
      
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch {}
        html5QrCodeRef.current = null;
      }

      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          handleTokenScanned(decodedText);
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
            await scanner.clear();
          } catch {}
          setScanning(false);
        },
        () => {}
      );
    } catch (err: any) {
      setErrorMsg('Camera access unavailable. Please grant camera permission in your browser to scan QR passes.');
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
          html5QrCodeRef.current.clear().catch(() => {});
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
        body: JSON.stringify({ qr_token: token, action: 'lookup', purpose }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Invalid QR — Team not found.');
        setActiveToken(null);
        setScannedTeam(null);
        setScannedMembers([]);
        setScannedCustomRecords([]);
        return;
      }

      setScannedTeam(data.team);
      setScannedMembers(data.members || []);
      setScannedCustomRecords(data.custom_records || []);
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

  const handleConfirmCustomEvent = async (count: number) => {
    if (!activeToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: activeToken,
          event_id: purpose,
          count,
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
      setErrorMsg(err.message || 'Error recording scan');
    } finally {
      setLoading(false);
    }
  };

  const closeModals = () => {
    setScannedTeam(null);
    setScannedMembers([]);
    setScannedCustomRecords([]);
    setActiveToken(null);
  };

  const autoResetAfterSuccess = () => {
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3500);
  };

  const baselinePurposes = [
    { key: 'registration', label: 'Registration', icon: Shield, activeColor: 'bg-nirmaan-green-bright text-nirmaan-black' },
    { key: 'breakfast', label: 'Breakfast', icon: Sun, activeColor: 'bg-nirmaan-amber text-nirmaan-black' },
    { key: 'lunch', label: 'Lunch', icon: Utensils, activeColor: 'bg-nirmaan-orange text-white' },
    { key: 'dinner', label: 'Dinner', icon: Moon, activeColor: 'bg-nirmaan-purple text-white' },
    { key: 'coffee', label: 'Coffee', icon: Coffee, activeColor: 'bg-nirmaan-blue text-white' },
  ];

  const customPurposes = customEvents.map((evt) => ({
    key: evt.id,
    label: evt.title,
    icon: (evt.icon && ICON_MAP[evt.icon]) || Sparkles,
    activeColor: `${evt.color} ${evt.text_color || 'text-white'}`,
  }));

  const allPurposes = [...baselinePurposes, ...customPurposes];
  const currentTheme = allPurposes.find((p) => p.key === purpose) || allPurposes[0];
  const CurrentIcon = currentTheme.icon;

  const activeCustomEvent = customEvents.find((e) => e.id === purpose);

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      {/* Compact Quick-Switch Purpose Selector */}
      <div className="w-full overflow-x-auto no-scrollbar py-1 px-1">
        <div className="flex items-center justify-start sm:justify-center gap-2 min-w-max mx-auto px-1">
          {allPurposes.map((p) => {
            const Icon = p.icon;
            const isSelected = purpose === p.key;

            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPurpose(p.key);
                  setErrorMsg(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? `${p.activeColor} border-2 border-nirmaan-black shadow-sm scale-105`
                    : 'bg-white text-nirmaan-black/75 hover:bg-nirmaan-cream border-2 border-nirmaan-black/15 shadow-xs'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{p.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsEventModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-nirmaan-black text-white hover:bg-nirmaan-black/80 shadow-xs flex-shrink-0 cursor-pointer"
            title="Create a new scan event"
          >
            <Plus className="w-3.5 h-3.5 text-nirmaan-amber" />
            <span>+ Event</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-nirmaan-green-bright border-2 border-nirmaan-black p-3 rounded-2xl flex items-center justify-between shadow-md animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-nirmaan-black flex-shrink-0" />
            <div>
              <p className="font-display font-black text-xs text-nirmaan-black uppercase">
                CONFIRMED
              </p>
              <p className="text-[11px] font-bold text-nirmaan-black/90">{successMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-[10px] font-bold bg-nirmaan-black text-white px-2.5 py-1 rounded-full hover:bg-nirmaan-black/80 flex-shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="bg-nirmaan-red text-white p-3 rounded-2xl flex items-start justify-between gap-2 shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-black text-xs uppercase">SCAN FAILED</p>
              <p className="text-[11px] font-medium text-white/90">{errorMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded flex-shrink-0"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Primary Scanner Viewport Card — Front and Center */}
      <div className="nirmaan-card p-4 sm:p-5 border-2 border-nirmaan-black bg-white flex flex-col items-center justify-center text-center shadow-sm">
        {/* Active Mode Header */}
        <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-nirmaan-black/10">
          <div className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-nirmaan-black">
            <span className="w-2 h-2 rounded-full bg-nirmaan-green-bright animate-pulse" />
            <CurrentIcon className="w-3.5 h-3.5 text-nirmaan-amber" />
            <span>MODE: {currentTheme.label}</span>
          </div>
          <span className="text-[10px] font-bold uppercase text-nirmaan-black/50">
            {scanning ? 'SCANNING...' : 'CAMERA IDLE'}
          </span>
        </div>

        {/* Camera Feed Target */}
        <div
          id="qr-reader"
          className="w-full max-w-[290px] sm:max-w-xs rounded-2xl overflow-hidden bg-nirmaan-cream/40 border border-nirmaan-black/10 flex items-center justify-center min-h-[220px]"
        >
          {!scanning && (
            <div className="p-6 flex flex-col items-center justify-center text-nirmaan-black/40 space-y-2">
              <Camera className="w-10 h-10 stroke-1 text-nirmaan-black/30" />
              <p className="text-xs font-bold uppercase text-nirmaan-black/50">
                Point Camera at Pass QR Code
              </p>
            </div>
          )}
        </div>

        {/* Scan Control Button */}
        <div className="w-full pt-4">
          {scanning ? (
            <button
              onClick={stopCamera}
              className="nirmaan-btn nirmaan-btn-outline text-xs py-3 w-full font-bold shadow-xs cursor-pointer"
            >
              STOP CAMERA
            </button>
          ) : (
            <button
              onClick={startCamera}
              disabled={loading}
              className="nirmaan-btn nirmaan-btn-primary text-xs py-3.5 w-full font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>START CAMERA SCANNER</span>
            </button>
          )}
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

      {/* Custom Event Serve Modal */}
      {scannedTeam && activeCustomEvent && (
        <CustomServeModal
          team={scannedTeam}
          members={scannedMembers}
          event={activeCustomEvent}
          existingRecords={scannedCustomRecords}
          onConfirmServe={handleConfirmCustomEvent}
          onCancel={closeModals}
          loading={loading}
        />
      )}

      {/* Quick Add Custom Event Modal */}
      {isEventModalOpen && (
        <CustomEventModal
          onClose={() => setIsEventModalOpen(false)}
          onCreated={(newEvent) => {
            setCustomEvents((prev) => [...prev, newEvent]);
            setPurpose(newEvent.id);
            setSuccessMsg(`Event "${newEvent.title}" created and activated in scanner!`);
          }}
        />
      )}
    </div>
  );
}
