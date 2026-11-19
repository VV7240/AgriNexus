import React, { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw, Search } from 'lucide-react';
import { Language, MarketPrice, User } from '../types';
import { t } from '../utils/i18n';

interface MarketPricesViewProps {
  user: User;
  language: Language;
  marketPrices: MarketPrice[];
  priceAlertThresholdPct: number;
  onRefreshFeed: () => Promise<void>;
  onOverridePrice: (id: string, pricePerKg: number) => Promise<void>;
}

export const MarketPricesView: React.FC<MarketPricesViewProps> = ({
  user,
  language,
  marketPrices,
  priceAlertThresholdPct,
  onRefreshFeed,
  onOverridePrice,
}) => {
  const isHi = language === 'hi';
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrideVal, setOverrideVal] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = user.role === 'fpo_admin' || user.role === 'system_admin';
  const crops = ['All', ...Array.from(new Set(marketPrices.map((m) => m.crop)))];

  const filtered = marketPrices.filter((m) => {
    const matchesCrop = cropFilter === 'All' || m.crop === cropFilter;
    const matchesSearch =
      !search.trim() ||
      m.crop.toLowerCase().includes(search.toLowerCase()) ||
      m.mandi.toLowerCase().includes(search.toLowerCase()) ||
      m.locality.toLowerCase().includes(search.toLowerCase());
    return matchesCrop && matchesSearch;
  });

  async function handleSaveOverride(id: string) {
    const val = Number(overrideVal);
    if (!Number.isFinite(val) || val <= 0) return;
    setBusy(true);
    try {
      await onOverridePrice(id, val);
      setEditingId(null);
      setOverrideVal('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141A15]">
            {t(language, 'navMarkets')}
          </h1>
          <p className="text-sm text-[#4B554D] mt-1">
            {isHi
              ? `Agmarknet और eNAM से दैनिक मंडी भाव · ±${priceAlertThresholdPct}% से अधिक बदलाव पर स्वचालित अलर्ट`
              : `Daily mandi prices & arrivals from Agmarknet / eNAM · Automatic alerts on ±${priceAlertThresholdPct}% movement`}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onRefreshFeed();
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isHi ? 'मंडी फीड रिफ्रेश करें' : 'Sync Agmarknet / eNAM Feed'}
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-white border border-[#E2E6DF] rounded-lg overflow-x-auto">
          {crops.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCropFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                cropFilter === c
                  ? 'bg-emerald-700 text-white'
                  : 'text-[#4B554D] hover:bg-[#F7F8F6]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#647066] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search crop or mandi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isHi ? 'मंडी या फसल खोजें...' : 'Search crop or mandi...'}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D4D9D0] rounded-lg"
          />
        </div>
      </div>

      {/* Market Table */}
      <div className="bg-white border border-[#E2E6DF] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E6DF] bg-[#F7F8F6] text-xs font-semibold text-[#647066]">
                <th className="py-3 px-4">Crop</th>
                <th className="py-3 px-4">Mandi / Locality</th>
                <th className="py-3 px-4 text-right">Price (₹/kg)</th>
                <th className="py-3 px-4 text-right">Short-Term Trend</th>
                <th className="py-3 px-4 text-right">Arrivals (t)</th>
                <th className="py-3 px-4">Source</th>
                {canManage && <th className="py-3 px-4 text-right">Admin Override</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6DF] text-sm">
              {filtered.map((mp) => (
                <tr key={mp.id} className="hover:bg-[#F7F8F6]">
                  <td className="py-3 px-4 font-semibold text-[#141A15]">{mp.crop}</td>
                  <td className="py-3 px-4">
                    <div className="text-[#141A15] font-medium">{mp.mandi}</div>
                    <div className="text-xs text-[#647066]">{mp.locality}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-[#141A15] tabular-nums">
                    ₹{mp.pricePerKg}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    <span
                      className={`inline-flex items-center justify-end gap-1 text-xs font-semibold ${
                        mp.trend === 'rising'
                          ? 'text-emerald-800'
                          : mp.trend === 'falling'
                          ? 'text-red-700'
                          : 'text-[#647066]'
                      }`}
                    >
                      {mp.trend === 'rising' ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : mp.trend === 'falling' ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      {mp.changePct > 0 ? `+${mp.changePct}%` : `${mp.changePct}%`} · {mp.trend}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#4B554D] tabular-nums">
                    {mp.arrivalsTonnes}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#647066]">
                    <div>{mp.source}</div>
                    {mp.overriddenBy && (
                      <div className="text-[11px] text-amber-700">by {mp.overriddenBy}</div>
                    )}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      {editingId === mp.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.5"
                            aria-label={`Override price for ${mp.mandi}`}
                            value={overrideVal}
                            onChange={(e) => setOverrideVal(e.target.value)}
                            className="w-20 px-2 py-1 text-xs font-mono border border-[#D4D9D0] rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveOverride(mp.id)}
                            className="px-2.5 py-1 bg-emerald-700 text-white text-xs rounded"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-xs text-[#647066]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(mp.id);
                            setOverrideVal(String(mp.pricePerKg));
                          }}
                          className="text-xs font-medium text-emerald-800 hover:underline"
                        >
                          Override
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
