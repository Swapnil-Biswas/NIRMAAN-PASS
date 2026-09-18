import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SponsorGrid from '@/components/Sponsors/SponsorGrid';
import { Calendar, HelpCircle } from 'lucide-react';

export default function EventInfoPage() {
  const scheduleItems = [
    { time: '09:00 AM', title: 'ON-DESK REGISTRATION & BADGE COLLECTION', tag: 'REGISTRATION', color: 'bg-nirmaan-amber', textColor: 'text-nirmaan-black' },
    { time: '10:00 AM', title: 'OPENING CEREMONY & PROBLEM STATEMENT REVEAL', tag: 'KEYNOTE', color: 'bg-nirmaan-blue', textColor: 'text-white' },
    { time: '11:00 AM', title: 'HACKING COMMENCES (36 HOURS NON-STOP)', tag: 'BUILD', color: 'bg-nirmaan-green-bright', textColor: 'text-nirmaan-black' },
    { time: '01:00 PM', title: 'LUNCH SERVING', tag: 'MEALS', color: 'bg-nirmaan-orange', textColor: 'text-white' },
    { time: '05:00 PM', title: 'MENTORSHIP ROUND 1', tag: 'MENTORING', color: 'bg-nirmaan-purple', textColor: 'text-white' },
    { time: '08:30 PM', title: 'DINNER SERVING', tag: 'MEALS', color: 'bg-nirmaan-orange', textColor: 'text-white' },
    { time: '12:00 AM', title: 'MIDNIGHT SNACKS & CHILL ZONE ACTIVATION', tag: 'SOCIAL', color: 'bg-nirmaan-blue', textColor: 'text-white' },
    { time: '08:00 AM', title: 'BREAKFAST SERVING (DAY 2)', tag: 'MEALS', color: 'bg-nirmaan-amber', textColor: 'text-nirmaan-black' },
    { time: '02:00 PM', title: 'FINAL CODE FREEZE & PPT SUBMISSION', tag: 'FINALE', color: 'bg-nirmaan-red', textColor: 'text-white' },
    { time: '04:00 PM', title: 'PITCHING & CLOSING AWARDS CEREMONY', tag: 'AWARDS', color: 'bg-nirmaan-amber', textColor: 'text-nirmaan-black' },
  ];

  const faqs = [
    {
      q: 'Do all members need to arrive at food counters together?',
      a: 'No! Your team members can scan and collect meals individually or in groups. The system tracks servings up to your present count.',
    },
    {
      q: 'What if a team member arrives late after registration?',
      a: 'Please visit the On-Desk Registration desk with your team QR code. Authorized organizers can perform an Attendance Correction.',
    },
    {
      q: 'Is coffee or tea limited per team?',
      a: 'No, coffee/tea is completely unlimited for all participating teams throughout NIRMAAN 2026.',
    },
    {
      q: 'Where do we show our digital QR pass?',
      a: 'Show the pass on your mobile screen or printed copy at On-Desk Registration and all Food/Coffee counters.',
    },
  ];

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full space-y-10">
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="nirmaan-pill bg-nirmaan-purple text-white text-xs mb-3 font-black">
            EVENT GUIDE & ESSENTIALS
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-black uppercase text-nirmaan-black leading-tight">
            NIRMAAN 2026 INFO
          </h1>
          <p className="text-sm sm:text-base font-semibold text-nirmaan-black/70 mt-2">
            Complete schedule, event details, and FAQs
          </p>
        </div>

        {/* Schedule */}
        <div className="nirmaan-card p-6 sm:p-8 bg-white border border-nirmaan-black/15 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-nirmaan-black/10">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-nirmaan-orange" />
              <h2 className="font-display text-xl font-black uppercase text-nirmaan-black">
                EVENT TIMELINE & SCHEDULE
              </h2>
            </div>
            <span className="text-xs font-bold text-nirmaan-black/50 uppercase">
              36-HOUR RUNTIME
            </span>
          </div>

          <div className="space-y-3">
            {scheduleItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-black text-nirmaan-black bg-white px-2.5 py-1 rounded-lg border border-nirmaan-black/10 shadow-xs">
                    {item.time}
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-nirmaan-black">
                    {item.title}
                  </span>
                </div>

                <span className={`nirmaan-pill ${item.color} ${item.textColor} text-[10px] self-start sm:self-auto font-black`}>
                  {item.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="nirmaan-card p-6 sm:p-8 bg-white border border-nirmaan-black/15 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-nirmaan-black/10">
            <HelpCircle className="w-5 h-5 text-nirmaan-blue" />
            <h2 className="font-display text-xl font-black uppercase text-nirmaan-black">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-nirmaan-cream/40 border border-nirmaan-black/10">
                <h4 className="font-display text-sm font-black uppercase text-nirmaan-black mb-1.5">
                  {faq.q}
                </h4>
                <p className="text-xs font-medium text-nirmaan-black/75 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Official Sponsors Section */}
        <div className="pt-6 border-t border-nirmaan-black/15">
          <SponsorGrid />
        </div>
      </main>

      <Footer />
    </div>
  );
}
