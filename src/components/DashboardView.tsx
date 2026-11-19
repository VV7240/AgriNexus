import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { Cluster, EnrichedBatch, Language, MarketPrice, User } from '../types';
import { getActionLabel, getRiskLabel, t } from '../utils/i18n';

interface DashboardViewProps {
  user: User;
  language: Language;
  batches: EnrichedBatch[];
  clusters: Cluster[];
  marketPrices: MarketPrice[];
  pendingSyncCount: number;
  offlineMode: boolean;
  onSelectBatch: (batchId: string) => void;
  onConfirmAction: (batchId: string, action: EnrichedBatch['recommendation']['recommendedAction']) => void;
  onNavigate: (page: string) => void;
  onExpressBuyerInterest: (clusterId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  language,
  batches,
  clusters,
  marketPrices,
  pendingSyncCount,
  offlineMode,
  onSelectBatch,
  onConfirmAction,
  onNavigate,
  onExpressBuyerInterest,
}) => {
  const isHi = language === 'hi';
  const highRiskBatches = batches.filter((b) => b.digitalTwin.spoilageRisk >= 70 && b.status === 'active');
  const totalKg = batches.reduce((sum, b) => sum + b.quantityKg, 0);
  const totalExpectedInr = batches.reduce((sum, b) => sum + b.recommendation.expectedValue, 0);
  const totalClusterSavings = clusters.reduce((sum, c) => sum + c.totalTransportSavingsInr, 0);

  return (
    <div className="space-y-8">
      {/* FR-2.4: High Spoilage Risk (>70%) Alert Banner */}
      {highRiskBatches.length > 0 && (
        <div
          role="alert"
          data-testid="spoilage-alert-banner"
          className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-sm font-semibold text-red-900">
                {t(language, 'highRiskAlertTitle')} ({highRiskBatches.length})
              </h2>
              <p className="text-sm text-red-800 mt-0.5">
                {t(language, 'highRiskAlertDesc')} —{' '}
                <span className="font-mono font-medium">
                  {highRiskBatches[0].id} ({highRiskBatches[0].crop},{' '}
                  {highRiskBatches[0].digitalTwin.spoilageRisk}% risk)
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectBatch(highRiskBatches[0].id)}
            className="px-4 py-2 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            {t(language, 'inspectBatch')}
          </button>
        </div>
      )}

      {/* Role-Specific Summary Metrics Strip */}
      <section aria-label="Key metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs font-medium text-[#647066]">
            {user.role === 'buyer'
              ? isHi
                ? 'उपलब्ध पूल क्लस्टर'
                : 'Available Pooled Lots'
              : t(language, 'activeBatches')}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#141A15] tabular-nums">
            {user.role === 'buyer' ? clusters.length : batches.length}
          </div>
          <div className="mt-1 text-xs text-[#647066] tabular-nums">
            {totalKg.toLocaleString('en-IN')} {t(language, 'kg')} {isHi ? 'कुल उपज' : 'total volume'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs font-medium text-[#647066]">
            {user.role === 'fpo_admin'
              ? isHi
                ? 'क्लस्टर परिवहन बचत'
                : 'Cluster Transport Savings'
              : t(language, 'expectedNetValue')}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-800 tabular-nums">
            ₹
            {(user.role === 'fpo_admin'
              ? Math.round(totalClusterSavings)
              : Math.round(totalExpectedInr)
            ).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-[#647066]">
            {user.role === 'fpo_admin'
              ? `${clusters.filter((c) => c.status === 'confirmed').length} ${isHi ? 'पुष्ट क्लस्टर' : 'confirmed clusters'}`
              : isHi
              ? 'इष्टतम निर्णय के आधार पर'
              : 'Based on optimal actions'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs font-medium text-[#647066]">
            {isHi ? 'उच्च जोखिम बैच (>70%)' : 'High Spoilage Risk (>70%)'}
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              highRiskBatches.length > 0 ? 'text-red-700' : 'text-[#141A15]'
            }`}
          >
            {highRiskBatches.length}
          </div>
          <div className="mt-1 text-xs text-[#647066]">
            {highRiskBatches.length > 0
              ? isHi
                ? 'तुरंत बिक्री/प्रसंस्करण आवश्यक'
                : 'Needs immediate dispatch'
              : isHi
              ? 'सभी बैच सुरक्षित सीमा में'
              : 'All batches within safe window'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs font-medium text-[#647066]">
            {isHi ? 'मंडी भाव फीड और सिंक' : 'Mandi Feed & Offline Queue'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#141A15] tabular-nums">
            {marketPrices.length} <span className="text-sm font-normal text-[#647066]">mandis</span>
          </div>
          <div className="mt-1 text-xs text-[#647066]">
            {offlineMode || pendingSyncCount > 0
              ? `${pendingSyncCount} ${t(language, 'pendingSync')}`
              : isHi
              ? 'Agmarknet / eNAM लाइव'
              : 'Agmarknet / eNAM synced'}
          </div>
        </div>
      </section>

      {/* BUYER / PROCESSOR VIEW (FR-2.3) */}
      {user.role === 'buyer' ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#141A15]">
                {isHi ? 'खरीद के लिए उपलब्ध पूल क्लस्टर' : 'Pooled Batches Available for Procurement'}
              </h2>
              <p className="text-sm text-[#4B554D]">
                {isHi
                  ? 'FPO द्वारा समूहीकृत गुणवत्ता-सत्यापित लॉट'
                  : 'Quality-verified farmer cluster lots consolidated in your procurement zone'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('clusters')}
              className="text-sm font-medium text-emerald-800 hover:underline whitespace-nowrap shrink-0"
            >
              {isHi ? 'सभी क्लस्टर देखें' : 'View all clusters'}
            </button>
          </div>

          {clusters.length === 0 ? (
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-8 text-center text-sm text-[#647066]">
              {isHi ? 'अभी कोई पूल क्लस्टर उपलब्ध नहीं है।' : 'No pooled clusters available right now.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((cluster) => (
                <article
                  key={cluster.id}
                  className="bg-white border border-[#E2E6DF] rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-display text-base font-semibold text-[#141A15]">
                        {cluster.crop} Pool · {cluster.id}
                      </h3>
                      <span
                        className={`text-xs font-semibold ${
                          cluster.status === 'confirmed' ? 'text-emerald-800' : 'text-amber-700'
                        }`}
                      >
                        {cluster.status === 'confirmed' ? 'Confirmed Pool' : 'Candidate Pool'}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-[#647066]">
                      {cluster.locality} · {cluster.farmerNames.length} farmers ·{' '}
                      <span className="font-mono tabular-nums">
                        {cluster.totalQuantityKg.toLocaleString('en-IN')} kg
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#E2E6DF] grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-[#647066]">Avg Quality</div>
                        <div className="font-mono font-semibold text-[#141A15] mt-0.5 tabular-nums">
                          {cluster.avgQualityScore}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[#647066]">Pooled Transport</div>
                        <div className="font-mono font-semibold text-[#141A15] mt-0.5 tabular-nums">
                          ₹{cluster.pooledTransportCostPerKg}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[#647066]">Buyer Inquiries</div>
                        <div className="font-mono font-semibold text-[#141A15] mt-0.5 tabular-nums">
                          {cluster.buyerInterests.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onExpressBuyerInterest(cluster.id)}
                    className="w-full py-2 px-4 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
                  >
                    {t(language, 'expressInterest')}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* FARMER / FPO ADMIN / SYSTEM ADMIN BATCH CARDS (FR-2.1, FR-2.2) */
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#141A15]">
                {user.role === 'fpo_admin'
                  ? isHi
                    ? 'FPO सक्रिय बैच और लाइव डिजिटल ट्विन'
                    : 'FPO Active Batches & Live Digital Twins'
                  : isHi
                  ? 'आपके सक्रिय फसल बैच'
                  : 'Your Active Harvest Batches'}
              </h2>
              <p className="text-sm text-[#4B554D]">
                {isHi
                  ? 'हर बैच का लाइव गुणवत्ता स्कोर, शेष शेल्फ-लाइफ और अनुशंसित कार्रवाई'
                  : 'Live computed quality, remaining shelf life, spoilage risk, and optimal action per batch'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('add-batch')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              {t(language, 'registerNewBatch')}
            </button>
          </div>

          {batches.length === 0 ? (
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-10 text-center space-y-4">
              <p className="text-sm text-[#4B554D] max-w-md mx-auto">
                {t(language, 'registerFirstBatch')}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('add-batch')}
                className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
              >
                {t(language, 'registerNewBatch')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="batch-cards-grid">
              {batches.map((batch) => {
                const { digitalTwin, recommendation } = batch;
                const riskColor =
                  digitalTwin.riskLevel === 'high'
                    ? 'text-red-700'
                    : digitalTwin.riskLevel === 'medium'
                    ? 'text-amber-700'
                    : 'text-emerald-800';

                return (
                  <article
                    key={batch.id}
                    data-testid={`batch-card-${batch.id}`}
                    className="bg-white border border-[#E2E6DF] rounded-xl p-5 flex flex-col justify-between gap-5"
                  >
                    <div>
                      {/* Card Header: Title + Unboxed Metadata (Zero-Pill Discipline) */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-base font-semibold text-[#141A15]">
                            {batch.crop} · {batch.id}
                          </h3>
                          <p className="text-xs text-[#647066] mt-0.5 tabular-nums">
                            {batch.locality} · {batch.quantityKg.toLocaleString('en-IN')}{' '}
                            {t(language, 'kg')} · {batch.ambientTempC}°C ·{' '}
                            {batch.storageMode === 'cold'
                              ? isHi
                                ? 'कोल्ड स्टोरेज'
                                : 'Cold Storage'
                              : isHi
                              ? 'सामान्य शेड'
                              : 'Ambient'}
                            {batch.pendingSync ? ` · ${t(language, 'pendingSync')}` : ''}
                          </p>
                        </div>

                        <div className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${riskColor}`}>
                          {digitalTwin.riskLevel === 'high' ? (
                            <ShieldAlert className="w-4 h-4" />
                          ) : digitalTwin.riskLevel === 'medium' ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>{getRiskLabel(language, digitalTwin.riskLevel)}</span>
                        </div>
                      </div>

                      {/* Digital Twin Telemetry Grid */}
                      <div className="mt-4 pt-4 border-t border-[#E2E6DF] grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-[#647066]">{t(language, 'qualityScore')}</div>
                          <div className="font-mono text-lg font-semibold text-[#141A15] mt-0.5 tabular-nums">
                            {digitalTwin.qualityScore}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[#647066]">
                            {t(language, 'shelfLifeRemaining')}
                          </div>
                          <div className="font-mono text-lg font-semibold text-[#141A15] mt-0.5 tabular-nums">
                            {digitalTwin.remainingShelfLifeHours} {t(language, 'hours')}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[#647066]">{t(language, 'spoilageRisk')}</div>
                          <div className={`font-mono text-lg font-semibold mt-0.5 tabular-nums ${riskColor}`}>
                            {digitalTwin.spoilageRisk}%
                          </div>
                        </div>
                      </div>

                      {/* Recommendation Summary */}
                      <div className="mt-4 pt-4 border-t border-[#E2E6DF] flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs text-[#647066]">
                            {t(language, 'recommendedAction')}
                          </div>
                          <div className="text-sm font-semibold text-[#141A15] mt-0.5">
                            {getActionLabel(language, recommendation.recommendedAction)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-[#647066]">
                            {t(language, 'expectedNetValue')}
                          </div>
                          <div className="font-mono text-base font-semibold text-emerald-800 mt-0.5 tabular-nums">
                            ₹{recommendation.expectedValue.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Two-tap confirmation & Digital Twin Inspection */}
                    <div className="flex items-center gap-3 pt-1">
                      {batch.status === 'action_confirmed' ? (
                        <div className="flex-1 py-2 px-3 bg-[#F1F3EF] border border-[#E2E6DF] text-[#141A15] text-xs font-medium rounded-lg text-center">
                          {t(language, 'actionConfirmed')}:{' '}
                          {getActionLabel(language, batch.confirmedAction ?? recommendation.recommendedAction)}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onConfirmAction(batch.id, recommendation.recommendedAction)
                          }
                          className="flex-1 py-2 px-3 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
                        >
                          {t(language, 'confirmAction')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectBatch(batch.id)}
                        className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-white border border-[#D4D9D0] text-[#141A15] text-xs font-medium rounded-lg hover:bg-[#F7F8F6] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>{t(language, 'inspectBatch')}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* FPO Admin Cluster Pooling Snapshot + Live Mandi Snapshot */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E6DF]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-800" />
              <h3 className="font-display text-sm font-semibold text-[#141A15]">
                {isHi ? 'क्लस्टर पूलिंग अवसर' : 'Cluster Pooling Opportunities'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('clusters')}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              {isHi ? 'प्रबंधित करें' : 'Open Pooling'}
            </button>
          </div>
          <div className="divide-y divide-[#E2E6DF]">
            {clusters.slice(0, 3).map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-medium text-[#141A15]">
                    {c.crop} · {c.locality}
                  </div>
                  <div className="text-xs text-[#647066] tabular-nums">
                    {c.batchIds.length} batches · {c.totalQuantityKg.toLocaleString('en-IN')} kg ·{' '}
                    {c.status === 'confirmed' ? 'Confirmed' : 'Candidate'}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-xs font-semibold text-emerald-800">
                    -₹{(c.individualTransportCostPerKg - c.pooledTransportCostPerKg).toFixed(2)}/kg
                  </div>
                  <div className="text-xs text-[#647066]">
                    Save ₹{Math.round(c.totalTransportSavingsInr).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E6DF]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-800" />
              <h3 className="font-display text-sm font-semibold text-[#141A15]">
                {isHi ? 'प्रमुख मंडी भाव (Agmarknet / eNAM)' : 'Top Mandi Prices (Agmarknet / eNAM)'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              {isHi ? 'सभी मंडी भाव' : 'All Markets'}
            </button>
          </div>
          <div className="divide-y divide-[#E2E6DF]">
            {marketPrices.slice(0, 4).map((mp) => (
              <div key={mp.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-medium text-[#141A15]">
                    {mp.crop} · {mp.mandi}
                  </div>
                  <div className="text-xs text-[#647066]">
                    {mp.locality} · {mp.source}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-sm font-semibold text-[#141A15]">₹{mp.pricePerKg}/kg</div>
                  <div
                    className={`text-xs ${
                      mp.trend === 'rising'
                        ? 'text-emerald-800'
                        : mp.trend === 'falling'
                        ? 'text-red-700'
                        : 'text-[#647066]'
                    }`}
                  >
                    {mp.changePct > 0 ? '+' : ''}
                    {mp.changePct}% ({mp.trend})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
