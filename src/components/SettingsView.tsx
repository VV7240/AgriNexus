import React, { useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Language, User } from '../types';
import { getRoleLabel, t } from '../utils/i18n';

interface SettingsViewProps {
  user: User;
  language: Language;
  offlineMode: boolean;
  pendingSyncCount: number;
  onLanguageChange: (lang: Language) => Promise<void>;
  onToggleOffline: (enabled: boolean) => void;
  onSyncNow: () => Promise<void>;
  onUpdateProfile: (payload: { name: string; locality: string }) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  language,
  offlineMode,
  pendingSyncCount,
  onLanguageChange,
  onToggleOffline,
  onSyncNow,
  onUpdateProfile,
}) => {
  const isHi = language === 'hi';
  const [name, setName] = useState(user.name);
  const [locality, setLocality] = useState(user.locality);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onUpdateProfile({ name, locality });
      setMessage(isHi ? 'प्रोफ़ाइल अपडेट की गई।' : 'Profile preferences saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#141A15]">
          {t(language, 'navSettings')}
        </h1>
        <p className="text-sm text-[#4B554D] mt-1">
          {isHi
            ? 'भाषा, ऑफ़लाइन-प्रथम सिंक और खाता प्राथमिकताएं प्रबंधित करें।'
            : 'Manage language localization, offline-first field sync, and account details.'}
        </p>
      </div>

      {message && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-xl">
          {message}
        </div>
      )}

      {/* Language & Offline Mode Controls */}
      <section className="bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E2E6DF]">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#141A15]">
              {isHi ? 'इंटरफ़ेस और एआई भाषा' : 'Interface & AgriNexus Assist Language'}
            </h2>
            <p className="text-xs text-[#647066] mt-0.5">
              {isHi
                ? 'डैशबोर्ड और सहायक उत्तरों के लिए हिंदी या अंग्रेजी चुनें'
                : 'Switch all farmer-facing labels, recommendations, and AI replies between English and Hindi'}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-[#F7F8F6] border border-[#E2E6DF] rounded-lg self-start">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                language === 'en'
                  ? 'bg-emerald-700 text-white'
                  : 'text-[#4B554D] hover:text-[#141A15]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('hi')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                language === 'hi'
                  ? 'bg-emerald-700 text-white'
                  : 'text-[#4B554D] hover:text-[#141A15]'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#141A15] flex items-center gap-2">
              {offlineMode ? (
                <WifiOff className="w-4 h-4 text-amber-700" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-700" />
              )}
              {isHi ? 'ऑफ़लाइन-प्रथम सिमुलेशन मोड' : 'Offline-First Connectivity Mode'}
            </h2>
            <p className="text-xs text-[#647066] mt-0.5">
              {isHi
                ? `कतार में लंबित बैच: ${pendingSyncCount}`
                : `Queued offline writes waiting for sync: ${pendingSyncCount}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleOffline(!offlineMode)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                offlineMode
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-white text-[#141A15] border-[#D4D9D0] hover:bg-[#F7F8F6]'
              }`}
            >
              {offlineMode ? 'Switch Back Online' : 'Simulate Offline Mode'}
            </button>
            {pendingSyncCount > 0 && !offlineMode && (
              <button
                type="button"
                onClick={onSyncNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t(language, 'syncNow')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Account Details */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-4"
      >
        <div className="pb-3 border-b border-[#E2E6DF] flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-[#141A15]">
            {isHi ? 'खाता विवरण' : 'Account & FPO Profile'}
          </h2>
          <span className="text-xs font-medium text-emerald-800">
            {getRoleLabel(language, user.role)} · {user.fpoName}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-medium text-[#4B554D] mb-1">
              Full Name
            </label>
            <input
              id="prof-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#D4D9D0] rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="prof-loc" className="block text-xs font-medium text-[#4B554D] mb-1">
              Locality
            </label>
            <input
              id="prof-loc"
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#D4D9D0] rounded-lg"
            />
          </div>
        </div>

        <div className="text-xs text-[#647066] font-mono">
          {user.phone ? `Mobile: +91-${user.phone}` : `Email: ${user.email}`} · Privacy: Farmer PII encrypted & scoped to owning FPO (SRS 6.2).
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};
