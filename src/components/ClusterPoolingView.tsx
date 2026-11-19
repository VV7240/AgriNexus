import React, { useState } from 'react';
import { CheckCircle2, Truck, Warehouse } from 'lucide-react';
import { Cluster, Language, User } from '../types';
import { t } from '../utils/i18n';

interface ClusterPoolingViewProps {
  user: User;
  language: Language;
  clusters: Cluster[];
  onConfirmCluster: (clusterId: string) => Promise<void>;
  onExpressInterest: (clusterId: string, note: string) => Promise<void>;
}

export const ClusterPoolingView: React.FC<ClusterPoolingViewProps> = ({
  user,
  language,
  clusters,
  onConfirmCluster,
  onExpressInterest,
}) => {
  const isHi = language === 'hi';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteByCluster, setNoteByCluster] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const canConfirm = user.role === 'fpo_admin' || user.role === 'system_admin';
  const canBuy = user.role === 'buyer';

  async function handleConfirm(id: string) {
    setBusyId(id);
    setFeedback(null);
    try {
      await onConfirmCluster(id);
      setFeedback(
        isHi
          ? `क्लस्टर ${id} पुष्ट हो गया और सभी सदस्य किसानों को SMS/ऐप सूचना भेजी गई।`
          : `Cluster ${id} confirmed! Member farmers notified via app alert & SMS fallback.`
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleBuyerRequest(id: string) {
    setBusyId(id);
    setFeedback(null);
    try {
      await onExpressInterest(
        id,
        noteByCluster[id] || 'Interested in full lot procurement at pooled rate.'
      );
      setFeedback(
        isHi
          ? `क्लस्टर ${id} के लिए खरीद अनुरोध FPO को भेजा गया।`
          : `Procurement interest recorded for cluster ${id}. FPO Administrator has been notified.`
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#141A15]">
          {t(language, 'navClusters')}
        </h1>
        <p className="text-sm text-[#4B554D] mt-1">
          {isHi
            ? 'एक ही क्षेत्र और कटाई समय-सीमा के बैचों को जोड़कर प्रति-किग्रा परिवहन व कोल्ड-स्टोरेज लागत घटाएं।'
            : 'Automatically groups compatible active batches by crop, locality, and harvest window to cut per-kg transport cost and share cold-storage capacity.'}
        </p>
      </div>

      {feedback && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-xl">
          {feedback}
        </div>
      )}

      {clusters.length === 0 ? (
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-10 text-center text-sm text-[#647066]">
          {isHi ? 'अभी कोई सक्रिय क्लस्टर नहीं मिला।' : 'No candidate clusters available right now.'}
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map((c) => {
            const savingsPerKg = (
              c.individualTransportCostPerKg - c.pooledTransportCostPerKg
            ).toFixed(2);
            const savingsPct = Math.round(
              ((c.individualTransportCostPerKg - c.pooledTransportCostPerKg) /
                Math.max(0.1, c.individualTransportCostPerKg)) *
                100
            );
            const storagePct = Math.min(
              100,
              Math.round((c.storageSlotAllocatedKg / Math.max(1, c.storageSlotTotalKg)) * 100)
            );

            return (
              <article
                key={c.id}
                data-testid={`cluster-card-${c.id}`}
                className="bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E2E6DF]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display text-lg font-semibold text-[#141A15]">
                        {c.crop} · {c.locality} ({c.id})
                      </h2>
                      <span
                        className={`text-xs font-semibold ${
                          c.status === 'confirmed' ? 'text-emerald-800' : 'text-amber-700'
                        }`}
                      >
                        {c.status === 'confirmed'
                          ? isHi
                            ? '· पुष्ट क्लस्टर'
                            : '· Confirmed'
                          : isHi
                          ? '· संभावित क्लस्टर'
                          : '· Candidate'}
                      </span>
                    </div>
                    <p className="text-xs text-[#647066] mt-1 tabular-nums">
                      {c.batchIds.length} {c.batchIds.length === 1 ? 'batch' : 'batches'} (
                      {c.batchIds.join(', ')}) · {c.farmerNames.join(', ')} · {c.harvestWindowHours}h{' '}
                      {isHi ? 'विंडो' : 'window'}
                    </p>
                  </div>

                  <div className="text-right font-mono tabular-nums">
                    <div className="text-lg font-bold text-[#141A15]">
                      {c.totalQuantityKg.toLocaleString('en-IN')} {t(language, 'kg')}
                    </div>
                    <div className="text-xs text-[#647066]">
                      {isHi ? 'औसत गुणवत्ता' : 'Weighted Avg Quality'}: {c.avgQualityScore}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Individual vs Pooled Transport Cost Comparison (FR-6.2) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#141A15]">
                      <Truck className="w-4 h-4 text-emerald-800" />
                      <span>
                        {isHi
                          ? 'परिवहन लागत तुलना (व्यक्तिगत बनाम पूल)'
                          : 'Individual vs Pooled Dispatch Cost'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                      <div>
                        <div className="text-[#647066]">
                          {isHi ? 'व्यक्तिगत' : 'Individual'}
                        </div>
                        <div className="font-mono text-sm font-semibold text-[#4B554D] line-through tabular-nums mt-0.5">
                          ₹{c.individualTransportCostPerKg}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[#647066]">
                          {isHi ? 'पूल दर' : 'Pooled Rate'}
                        </div>
                        <div className="font-mono text-sm font-semibold text-emerald-800 tabular-nums mt-0.5">
                          ₹{c.pooledTransportCostPerKg}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[#647066]">
                          {isHi ? 'कुल बचत' : 'Total Savings'}
                        </div>
                        <div className="font-mono text-sm font-semibold text-emerald-800 tabular-nums mt-0.5">
                          ₹{Math.round(c.totalTransportSavingsInr).toLocaleString('en-IN')} ({savingsPct}%)
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[#647066] font-mono tabular-nums">
                      {isHi
                        ? `${c.batchIds.length} पूल्ड बैचों पर ₹${savingsPerKg}/किग्रा की बचत।`
                        : `Saves ₹${savingsPerKg}/kg across ${c.batchIds.length} pooled ${c.batchIds.length === 1 ? 'batch' : 'batches'}.`}
                    </p>
                  </div>

                  {/* Cold-Storage Slot Sharing (FR-6.4) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#141A15]">
                      <span className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4 text-emerald-800" />
                        {c.storageFacilityName}
                      </span>
                      <span className="font-mono tabular-nums text-[#4B554D]">
                        {c.storageSlotAllocatedKg.toLocaleString('en-IN')} /{' '}
                        {c.storageSlotTotalKg.toLocaleString('en-IN')} kg ({storagePct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#F1F3EF] rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-700"
                        style={{ width: `${storagePct}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#647066]">
                      {(c.storageSlotTotalKg - c.storageSlotAllocatedKg).toLocaleString('en-IN')} kg
                      shared cold-storage slot capacity remaining.
                    </p>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-4 border-t border-[#E2E6DF] flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-[#647066]">
                    {c.buyerInterests.length > 0
                      ? `${c.buyerInterests.length} buyer procurement request(s) received`
                      : 'No buyer procurement requests yet'}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {canConfirm && c.status !== 'confirmed' && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => handleConfirm(c.id)}
                        className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
                      >
                        {busyId === c.id
                          ? 'Confirming...'
                          : t(language, 'confirmCluster')}
                      </button>
                    )}

                    {canConfirm && c.status === 'confirmed' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmed & Farmers Notified
                      </span>
                    )}

                    {canBuy && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          aria-label={`Procurement note for ${c.id}`}
                          value={noteByCluster[c.id] ?? ''}
                          onChange={(e) =>
                            setNoteByCluster((prev) => ({
                              ...prev,
                              [c.id]: e.target.value,
                            }))
                          }
                          placeholder="Offer price or pickup note..."
                          className="px-3 py-1.5 text-xs border border-[#D4D9D0] rounded-lg"
                        />
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleBuyerRequest(c.id)}
                          className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 whitespace-nowrap"
                        >
                          {t(language, 'expressInterest')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
