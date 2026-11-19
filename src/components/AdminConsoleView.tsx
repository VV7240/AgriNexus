import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Unlock, UserCheck } from 'lucide-react';
import { api } from '../services/api';
import { CropConstant, Language, SystemSettings, User, UserRole } from '../types';
import { t } from '../utils/i18n';

interface AdminConsoleViewProps {
  currentUser: User;
  language: Language;
  onConstantsUpdated: () => Promise<void>;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  currentUser,
  language,
  onConstantsUpdated,
}) => {
  const isHi = language === 'hi';
  const [users, setUsers] = useState<User[]>([]);
  const [crops, setCrops] = useState<CropConstant[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [health, setHealth] = useState<{
    uptimeSeconds: number;
    totalBatches: number;
    totalOutcomesLogged: number;
    activeSessions: number;
    geminiConfigured: boolean;
    lastMarketSyncAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadOverview() {
    setLoading(true);
    try {
      const data = await api.getAdminOverview();
      setUsers(data.users);
      setCrops(data.cropConstants);
      setSettings(data.settings);
      setHealth(data.health);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function handleUserUpdate(
    id: string,
    payload: { approved?: boolean; role?: UserRole; unlock?: boolean }
  ) {
    const res = await api.updateAdminUser(id, payload);
    setUsers((prev) => prev.map((u) => (u.id === id ? res.user : u)));
    setFeedback(`Updated user ${res.user.name}.`);
  }

  async function handleCropSave(crop: CropConstant) {
    const res = await api.updateCropConstant(crop.crop, {
      baseShelfLifeHours: crop.baseShelfLifeHours,
      processingRatePerKg: crop.processingRatePerKg,
      storageCostPerKgPerDay: crop.storageCostPerKgPerDay,
      pooledTransportRatePerKg: crop.pooledTransportRatePerKg,
    });
    setCrops((prev) => prev.map((c) => (c.crop === crop.crop ? res.cropConstant : c)));
    await onConstantsUpdated();
    setFeedback(`Updated crop constants for ${crop.crop} and recomputed Digital Twins.`);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const res = await api.updateSettings(settings);
    setSettings(res.settings);
    await onConstantsUpdated();
    setFeedback('System thresholds saved.');
  }

  if (loading) {
    return (
      <div className="bg-white border border-[#E2E6DF] rounded-xl p-8 text-sm text-[#647066]">
        Loading admin console...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#141A15]">
          {t(language, 'navAdmin')}
        </h1>
        <p className="text-sm text-[#4B554D] mt-1">
          {isHi
            ? 'उपयोगकर्ता भूमिका प्रबंधन, फसल स्थिरांक कॉन्फ़िगरेशन और सिस्टम स्वास्थ्य'
            : 'Manage FPO farmer approvals, RBAC roles, crop shelf-life constants, alert thresholds, and platform health.'}
        </p>
      </div>

      {feedback && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-xl">
          {feedback}
        </div>
      )}

      {/* System Health Overview (FR-12.3) */}
      {health && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
            <div className="text-xs text-[#647066] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-700" />
              Platform Uptime
            </div>
            <div className="font-mono text-xl font-bold text-[#141A15] mt-1.5 tabular-nums">
              {health.uptimeSeconds}s
            </div>
            <div className="text-xs text-[#647066] mt-1">
              {health.activeSessions} active sessions
            </div>
          </div>

          <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
            <div className="text-xs text-[#647066]">ML Feedback Outcomes Logged</div>
            <div className="font-mono text-xl font-bold text-[#141A15] mt-1.5 tabular-nums">
              {health.totalOutcomesLogged}
            </div>
            <div className="text-xs text-[#647066] mt-1">
              {health.totalBatches} total batches stored
            </div>
          </div>

          <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
            <div className="text-xs text-[#647066]">AgriNexus Assist LLM</div>
            <div className="font-mono text-sm font-semibold text-emerald-800 mt-2">
              {health.geminiConfigured ? 'Gemini RAG Ready' : 'Offline Template Mode'}
            </div>
            <div className="text-xs text-[#647066] mt-1">Model: gemini-4-hydrogen</div>
          </div>

          <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
            <div className="text-xs text-[#647066]">Last Agmarknet Sync</div>
            <div className="font-mono text-xs font-medium text-[#141A15] mt-2 tabular-nums">
              {new Date(health.lastMarketSyncAt).toLocaleString()}
            </div>
          </div>
        </section>
      )}

      {/* User Accounts & FPO Approvals (FR-1.3, FR-12.1) */}
      <section className="bg-white border border-[#E2E6DF] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#E2E6DF] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <h2 className="font-display text-base font-semibold text-[#141A15]">
            User Accounts, FPO Approvals & Role Access Control
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E6DF] bg-[#F7F8F6] text-xs font-semibold text-[#647066]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6DF] text-sm">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#F7F8F6]">
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#141A15]">{u.name}</div>
                    <div className="text-xs text-[#647066]">
                      {u.locality} · {u.fpoName}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#4B554D]">
                    {u.phone || u.email}
                  </td>
                  <td className="py-3 px-4">
                    {currentUser.role === 'system_admin' ? (
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        onChange={(e) =>
                          handleUserUpdate(u.id, { role: e.target.value as UserRole })
                        }
                        className="px-2 py-1 text-xs border border-[#D4D9D0] rounded bg-white"
                      >
                        <option value="farmer">Farmer</option>
                        <option value="fpo_admin">FPO Admin</option>
                        <option value="buyer">Buyer / Processor</option>
                        <option value="system_admin">System Admin</option>
                      </select>
                    ) : (
                      <span className="text-xs font-medium text-[#141A15]">{u.role}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {u.lockedUntil ? (
                      <span className="text-red-700 font-semibold">Locked</span>
                    ) : u.approved ? (
                      <span className="text-emerald-800 font-medium">Approved</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Pending Approval</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {!u.approved && (
                      <button
                        type="button"
                        onClick={() => handleUserUpdate(u.id, { approved: true })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white text-xs rounded hover:bg-emerald-800"
                      >
                        <UserCheck className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {u.lockedUntil && (
                      <button
                        type="button"
                        onClick={() => handleUserUpdate(u.id, { unlock: true })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white text-xs rounded"
                      >
                        <Unlock className="w-3 h-3" /> Unlock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Crop Constants Configuration (FR-12.2) */}
      <section className="bg-white border border-[#E2E6DF] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#E2E6DF]">
          <h2 className="font-display text-base font-semibold text-[#141A15]">
            Crop Shelf-Life & Cost Constants
          </h2>
          <p className="text-xs text-[#647066] mt-0.5">
            Changes update Digital Twin decay curves and Decision Engine formulas immediately
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E6DF] bg-[#F7F8F6] text-xs font-semibold text-[#647066]">
                <th className="py-3 px-4">Crop</th>
                <th className="py-3 px-4">Base Shelf Life (h @ 20°C)</th>
                <th className="py-3 px-4">Processing Rate (₹/kg)</th>
                <th className="py-3 px-4">Storage Cost (₹/kg/day)</th>
                <th className="py-3 px-4">Pooled Transport (₹/kg)</th>
                <th className="py-3 px-4 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6DF] text-sm">
              {crops.map((c) => (
                <tr key={c.crop}>
                  <td className="py-2.5 px-4 font-medium text-[#141A15]">{c.crop}</td>
                  <td className="py-2.5 px-4">
                    <input
                      type="number"
                      aria-label={`${c.crop} base shelf life`}
                      value={c.baseShelfLifeHours}
                      onChange={(e) =>
                        setCrops((prev) =>
                          prev.map((x) =>
                            x.crop === c.crop
                              ? { ...x, baseShelfLifeHours: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      className="w-24 px-2 py-1 text-xs font-mono border border-[#D4D9D0] rounded"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <input
                      type="number"
                      step="0.5"
                      aria-label={`${c.crop} processing rate`}
                      value={c.processingRatePerKg}
                      onChange={(e) =>
                        setCrops((prev) =>
                          prev.map((x) =>
                            x.crop === c.crop
                              ? { ...x, processingRatePerKg: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      className="w-24 px-2 py-1 text-xs font-mono border border-[#D4D9D0] rounded"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <input
                      type="number"
                      step="0.1"
                      aria-label={`${c.crop} storage cost`}
                      value={c.storageCostPerKgPerDay}
                      onChange={(e) =>
                        setCrops((prev) =>
                          prev.map((x) =>
                            x.crop === c.crop
                              ? { ...x, storageCostPerKgPerDay: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      className="w-24 px-2 py-1 text-xs font-mono border border-[#D4D9D0] rounded"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <input
                      type="number"
                      step="0.1"
                      aria-label={`${c.crop} pooled transport`}
                      value={c.pooledTransportRatePerKg}
                      onChange={(e) =>
                        setCrops((prev) =>
                          prev.map((x) =>
                            x.crop === c.crop
                              ? { ...x, pooledTransportRatePerKg: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      className="w-24 px-2 py-1 text-xs font-mono border border-[#D4D9D0] rounded"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleCropSave(c)}
                      className="px-3 py-1 bg-emerald-700 text-white text-xs font-semibold rounded hover:bg-emerald-800"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Alert & Cluster Thresholds */}
      {settings && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-[#E2E6DF] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label htmlFor="set-spoil" className="block text-xs font-medium text-[#4B554D] mb-1">
              Spoilage Alert Threshold (%)
            </label>
            <input
              id="set-spoil"
              type="number"
              value={settings.spoilageAlertThresholdPct}
              onChange={(e) =>
                setSettings({ ...settings, spoilageAlertThresholdPct: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-xs font-mono border border-[#D4D9D0] rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="set-price" className="block text-xs font-medium text-[#4B554D] mb-1">
              Price Movement Alert (%)
            </label>
            <input
              id="set-price"
              type="number"
              value={settings.priceAlertThresholdPct}
              onChange={(e) =>
                setSettings({ ...settings, priceAlertThresholdPct: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-xs font-mono border border-[#D4D9D0] rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="set-window" className="block text-xs font-medium text-[#4B554D] mb-1">
              Cluster Harvest Window (h)
            </label>
            <input
              id="set-window"
              type="number"
              value={settings.clusterHarvestWindowHours}
              onChange={(e) =>
                setSettings({ ...settings, clusterHarvestWindowHours: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-xs font-mono border border-[#D4D9D0] rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
          >
            Save Thresholds
          </button>
        </form>
      )}
    </div>
  );
};
