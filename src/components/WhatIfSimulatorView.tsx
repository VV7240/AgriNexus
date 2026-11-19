import React, { useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import {
  CropConstant,
  EnrichedBatch,
  Language,
  MarketPrice,
  SavedScenario,
} from '../types';
import { getActionLabel, t } from '../utils/i18n';
import { simulateWhatIf } from '../utils/prediction';

interface WhatIfSimulatorViewProps {
  batches: EnrichedBatch[];
  cropConstants: CropConstant[];
  marketPrices: MarketPrice[];
  savedScenarios: SavedScenario[];
  language: Language;
  initialBatchId?: string;
  onSaveScenario: (payload: Omit<SavedScenario, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
}

export const WhatIfSimulatorView: React.FC<WhatIfSimulatorViewProps> = ({
  batches,
  cropConstants,
  marketPrices,
  savedScenarios,
  language,
  initialBatchId,
  onSaveScenario,
}) => {
  const isHi = language === 'hi';
  const [selectedBatchId, setSelectedBatchId] = useState(
    initialBatchId || batches[0]?.id || ''
  );
  const [transportDelayHours, setTransportDelayHours] = useState(0);
  const [storageDays, setStorageDays] = useState(3);
  const [storageMode, setStorageMode] = useState<'ambient' | 'cold'>('cold');
  const [priceTrendDeltaPct, setPriceTrendDeltaPct] = useState(0);
  const [clusterPoolSize, setClusterPoolSize] = useState(3);

  const [scenarioName, setScenarioName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const batch = batches.find((b) => b.id === selectedBatchId) ?? batches[0];
  const cropConstant = cropConstants.find(
    (c) => c.crop.toLowerCase() === batch?.crop.toLowerCase()
  );

  const simResult = useMemo(() => {
    if (!batch || !cropConstant) return null;
    return simulateWhatIf(batch, cropConstant, marketPrices, {
      transportDelayHours,
      storageDays,
      storageMode,
      priceTrendDeltaPct,
      clusterPoolSize,
    });
  }, [
    batch,
    cropConstant,
    marketPrices,
    transportDelayHours,
    storageDays,
    storageMode,
    priceTrendDeltaPct,
    clusterPoolSize,
  ]);

  function handleReset() {
    setTransportDelayHours(0);
    setStorageDays(3);
    setStorageMode('cold');
    setPriceTrendDeltaPct(0);
    setClusterPoolSize(3);
    setSavedNotice(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!batch || !simResult) return;
    const label =
      scenarioName.trim() ||
      `${batch.crop} · Delay ${transportDelayHours}h · Pool ${clusterPoolSize}`;
    setSaving(true);
    try {
      await onSaveScenario({
        batchId: batch.id,
        name: label,
        transportDelayHours,
        storageDays,
        storageMode,
        priceTrendDeltaPct,
        clusterPoolSize,
        recommendedAction: simResult.recommendation.recommendedAction,
        expectedValueInr: simResult.recommendation.expectedValue,
      });
      setScenarioName('');
      setSavedNotice(isHi ? 'परिदृश्य सहेजा गया।' : 'Scenario saved locally and synced.');
    } finally {
      setSaving(false);
    }
  }

  if (!batch || !simResult) {
    return (
      <div className="bg-white border border-[#E2E6DF] rounded-xl p-8 text-center text-sm text-[#647066]">
        {isHi
          ? 'सिमुलेशन चलाने के लिए पहले एक सक्रिय बैच जोड़ें।'
          : 'Register at least one active batch to run What-If simulations.'}
      </div>
    );
  }

  const baselineAction = batch.recommendation.recommendedAction;
  const simAction = simResult.recommendation.recommendedAction;
  const actionFlipped = baselineAction !== simAction;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141A15]">
            {t(language, 'navSimulator')}
          </h1>
          <p className="text-sm text-[#4B554D] mt-0.5">
            {isHi
              ? 'परिवहन देरी, भंडारण दिन, मंडी भाव और क्लस्टर आकार बदलकर लाइव प्रभाव देखें।'
              : 'Adjust transport delay, storage duration, price movement, and cluster pool size to test how optimal decisions shift live.'}
          </p>
        </div>

        <select
          aria-label="Select batch for simulation"
          value={batch.id}
          onChange={(e) => setSelectedBatchId(e.target.value)}
          className="px-3.5 py-2 text-sm font-medium bg-white border border-[#D4D9D0] rounded-lg"
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} · {b.crop} ({b.quantityKg} kg)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Panel */}
        <section className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E6DF]">
            <h2 className="font-display text-base font-semibold text-[#141A15]">
              {isHi ? 'सिमुलेशन पैरामीटर' : 'Simulation Parameters'}
            </h2>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B554D] hover:text-[#141A15]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isHi ? 'रीसेट' : 'Reset'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <label htmlFor="sim-delay" className="text-[#141A15]">
                  {isHi ? 'परिवहन देरी (घंटे)' : 'Transport Delay'}
                </label>
                <span className="font-mono tabular-nums text-emerald-800">
                  {transportDelayHours}h
                </span>
              </div>
              <input
                id="sim-delay"
                type="range"
                min="0"
                max="48"
                step="2"
                value={transportDelayHours}
                onChange={(e) => setTransportDelayHours(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <label htmlFor="sim-storage-days" className="text-[#141A15]">
                  {isHi ? 'भंडारण अवधि (दिन)' : 'Storage Duration'}
                </label>
                <span className="font-mono tabular-nums text-emerald-800">{storageDays} days</span>
              </div>
              <input
                id="sim-storage-days"
                type="range"
                min="0"
                max="14"
                step="1"
                value={storageDays}
                onChange={(e) => setStorageDays(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-[#141A15] mb-1.5">
                {t(language, 'storageMode')}
              </span>
              <div className="flex gap-2 p-1 bg-[#F7F8F6] border border-[#E2E6DF] rounded-lg">
                <button
                  type="button"
                  onClick={() => setStorageMode('cold')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    storageMode === 'cold'
                      ? 'bg-white text-[#141A15] shadow-xs'
                      : 'text-[#4B554D]'
                  }`}
                >
                  {t(language, 'coldStorage')}
                </button>
                <button
                  type="button"
                  onClick={() => setStorageMode('ambient')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    storageMode === 'ambient'
                      ? 'bg-white text-[#141A15] shadow-xs'
                      : 'text-[#4B554D]'
                  }`}
                >
                  {t(language, 'ambientStorage')}
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <label htmlFor="sim-price" className="text-[#141A15]">
                  {isHi ? 'मंडी भाव बदलाव (%)' : 'Market Price Movement'}
                </label>
                <span className="font-mono tabular-nums text-emerald-800">
                  {priceTrendDeltaPct > 0 ? `+${priceTrendDeltaPct}%` : `${priceTrendDeltaPct}%`}
                </span>
              </div>
              <input
                id="sim-price"
                type="range"
                min="-30"
                max="30"
                step="2"
                value={priceTrendDeltaPct}
                onChange={(e) => setPriceTrendDeltaPct(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <label htmlFor="sim-pool" className="text-[#141A15]">
                  {isHi ? 'क्लस्टर पूल आकार (किसान)' : 'Cluster Pool Size (Farmers)'}
                </label>
                <span className="font-mono tabular-nums text-emerald-800">
                  {clusterPoolSize} {clusterPoolSize === 1 ? 'farmer (solo)' : 'farmers'}
                </span>
              </div>
              <input
                id="sim-pool"
                type="range"
                min="1"
                max="8"
                step="1"
                value={clusterPoolSize}
                onChange={(e) => setClusterPoolSize(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
            </div>
          </div>

          <form onSubmit={handleSave} className="pt-4 border-t border-[#E2E6DF] space-y-2.5">
            <label htmlFor="scn-name" className="block text-xs font-medium text-[#4B554D]">
              {isHi ? 'परिदृश्य का नाम (वैकल्पिक, गैर-स्थायी जब तक सहेजा न जाए)' : 'Save Scenario (non-persistent until saved)'}
            </label>
            <div className="flex gap-2">
              <input
                id="scn-name"
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g. 24h Rain Delay + 5 Farmer Pool"
                className="flex-1 px-3 py-2 text-xs border border-[#D4D9D0] rounded-lg"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                {t(language, 'saveScenario')}
              </button>
            </div>
            {savedNotice && <p className="text-xs text-emerald-800">{savedNotice}</p>}
          </form>
        </section>

        {/* Live Output Panel */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E2E6DF]">
              <div>
                <div className="text-xs font-medium text-[#647066]">
                  {isHi ? 'सिमुलेटेड अनुशंसा' : 'Live Simulated Recommendation'}
                </div>
                <div className="font-display text-2xl font-bold text-emerald-800 mt-0.5">
                  {getActionLabel(language, simAction)}
                </div>
                {actionFlipped && (
                  <p className="text-xs font-medium text-amber-700 mt-1">
                    {isHi
                      ? `निर्णय बदला: ${getActionLabel(language, baselineAction)} → ${getActionLabel(language, simAction)}`
                      : `Decision shifted from ${getActionLabel(language, baselineAction)} to ${getActionLabel(language, simAction)} under these conditions`}
                  </p>
                )}
              </div>

              <div className="text-right">
                <div className="text-xs text-[#647066]">{t(language, 'expectedNetValue')}</div>
                <div
                  data-testid="sim-expected-value"
                  className="font-mono text-2xl font-bold text-[#141A15] mt-0.5 tabular-nums"
                >
                  ₹{simResult.recommendation.expectedValue.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-[#647066] font-mono tabular-nums mt-0.5">
                  Post-delay/storage quality: {simResult.simulatedQuality}% · Risk:{' '}
                  {simResult.simulatedSpoilageRisk}%
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {[...simResult.recommendation.options]
                .sort((a, b) => b.expectedNetValue - a.expectedNetValue)
                .map((opt) => {
                  const isBest = opt.action === simAction;
                  const maxVal = Math.max(
                    1,
                    ...simResult.recommendation.options.map((o) => Math.abs(o.expectedNetValue))
                  );
                  const barPct = Math.max(
                    4,
                    Math.min(100, Math.round((Math.max(0, opt.expectedNetValue) / maxVal) * 100))
                  );
                  return (
                    <div key={opt.action} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={isBest ? 'font-semibold text-emerald-800' : 'text-[#141A15]'}>
                          {getActionLabel(language, opt.action)}
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-[#141A15]">
                          ₹{opt.expectedNetValue.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#F1F3EF] rounded overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${
                            isBest ? 'bg-emerald-700' : 'bg-[#94A396]'
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <div className="text-xs font-mono text-[#647066] tabular-nums">
                        {opt.formulaValuesText}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {savedScenarios.length > 0 && (
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
              <h3 className="font-display text-sm font-semibold text-[#141A15] pb-3 border-b border-[#E2E6DF]">
                {isHi ? 'सहेजे गए परिदृश्य' : 'Saved Scenarios'}
              </h3>
              <div className="divide-y divide-[#E2E6DF]">
                {savedScenarios.map((scn) => (
                  <div key={scn.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-medium text-[#141A15]">{scn.name}</div>
                      <div className="text-[#647066] font-mono tabular-nums mt-0.5">
                        {scn.batchId} · Delay {scn.transportDelayHours}h · Store {scn.storageDays}d ({scn.storageMode}) · Pool {scn.clusterPoolSize}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-semibold text-emerald-800">
                        {getActionLabel(language, scn.recommendedAction)}
                      </div>
                      <div className="text-[#141A15]">
                        ₹{scn.expectedValueInr.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
