import React, { useState, useEffect } from 'react';
import { X, Users, ArrowRight } from 'lucide-react';

const COMMUNITY_URL = 'https://chat.whatsapp.com/En8IzG1D2WvHpyBvEXF9ls';
const DISMISS_KEY = 'wa-community-banner-dismissed';

const WhatsAppIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

// Inline banner card - high visibility on shop page
export const WhatsAppCommunityBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const handleDismiss = (e) => {
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <a
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-cyan-500/10 p-4 sm:p-5 mb-6 transition-all hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/20"
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" aria-hidden="true" />

      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <WhatsAppIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-white font-bold text-sm sm:text-base">Join our WhatsApp Community</h3>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              <Users className="w-3 h-3" /> Active
            </span>
          </div>
          <p className="text-dark-300 text-xs sm:text-sm truncate">
            Get exclusive deals, instant updates & priority support.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white font-semibold text-sm transition-colors flex-shrink-0">
          Join Now
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>

        <ArrowRight className="sm:hidden w-5 h-5 text-emerald-400 flex-shrink-0" />

        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 p-1.5 rounded-lg hover:bg-dark-800/60 text-dark-500 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </a>
  );
};

// Floating WhatsApp community button - persistent access, bottom-left to avoid chat FAB
export const WhatsAppCommunityFAB = () => {
  return (
    <a
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Join WhatsApp Community"
      className="fixed bottom-6 left-6 z-40 group flex items-center gap-2 pl-3.5 pr-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/40 transition-all hover:scale-105 active:scale-95"
    >
      <span className="relative flex">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" aria-hidden="true" />
        <WhatsAppIcon className="w-5 h-5 relative" />
      </span>
      <span className="text-sm font-semibold whitespace-nowrap max-w-0 overflow-hidden group-hover:max-w-[140px] transition-[max-width] duration-300">
        Join Community
      </span>
    </a>
  );
};

export default WhatsAppCommunityBanner;
