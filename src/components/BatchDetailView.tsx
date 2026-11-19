import React, { useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  MessageSquare,
  RefreshCw,
  Sliders,
  Thermometer,
} from 'lucide-react';
import { ActionType, Batch, EnrichedBatch, Language } from '../types';
import { getActionLabel, getRiskLabel, t } from '../utils/i18n';

interface BatchDetailViewProps {
  batch: EnrichedBatch;
  allBatches: EnrichedBatch[];
  language: Language;
  onSelectBatchId: (id: string) => void;
  onBack: () => void;
  onUpdateBatch: (id: string, payload: Partial<Batch>) => Promise<void>;
  onConfirmAction: (id: string, action: ActionType) => Promise<void>;
  onLogOutcome: (
    id: string,
    payload: {
      actualActionTaken: ActionType;
      actualValueRealisedInr: number;
      actualSpoilagePct: number;
    }
  ) => Promise<void>;
  onOpenSimulator: (batchId: string) => void;
  onOpenAssist: (batchId: string) => void;
}

export const BatchDetailView: React.FC<BatchDetailViewProps> = ({
  batch,
  allBatches,
  language,
  onSelectBatchId,
  onBack,
  onUpdateBatch,
  onConfirmAction,
  onLogOutcome,
  onOpenSimulator,
  onOpenAssist,
}) => {
  const isHi = language === 'hi';
  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState(String(batch.quantityKg));
  const [editTemp, setEditTemp] = useState(String(batch.ambientTempC));
  const [editStorage, setEditStorage] = useState<'ambient' | 'cold'>(batch.storageMode);

  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [actualAction, setActualAction] = useState<ActionType>(
    batch.confirmedAction ?? batch.recommendation.recommendedAction
  );
  const [actualValue, setActualValue] = useState(
    String(Math.round(batch.recommendation.expectedValue))
  );
  const [actualSpoilage, setActualSpoilage] = useState('4');
  const [busy, setBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const { digitalTwin, recommendation } = batch;
  const riskColor =
    digitalTwin.riskLevel === 'high'
      ? 'text-red-700'
      : digitalTwin.riskLevel === 'medium'
      ? 'text-amber-700'
      : 'text-emerald-800';

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onUpdateBatch(batch.id, {
        quantityKg: Number(editQty),
        ambientTempC: Number(editTemp),
        storageMode: editStorage,
      });
      setEditing(false);
      setFeedbackMsg(isHi ? 'बैच अपडेट हो गया।' : 'Batch updated and Digital Twin recomputed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);
    try {
      await onUpdateBatch(batch.id, { status: 'archived' });
      onBack();
    } finally {
      setBusy(false);
    }
  }

  async function handleOutcomeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onLogOutcome(batch.id, {
        actualActionTaken: actualAction,
        actualValueRealisedInr: Number(actualValue),
        actualSpoilagePct: Number(actualSpoilage),
      });
      setShowOutcomeForm(false);
      setFeedbackMsg(
        isHi
          ? 'वास्तविक परिणाम लॉग किया गया। भविष्य के ML मॉडल प्रशिक्षण के लिए सहेजा गया।'
          : 'Actual outcome logged to feedback dataset for future ML model training (FR-4.4).'
      );
    } finally {
      setBusy(false);
    }
  }

  // Build SVG polyline points for 72h decay curve
  const svgW = 460;
  const svgH = 150;
  const padX = 28;
  const padY = 14;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;

  const toCoords = (idx: number, val: number) => {
    const x = padX + (idx / Math.max(1, digitalTwin.decayCurve.length - 1)) * plotW;
    const y = padY + ((100 - val) / 100) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const ambientPoints = digitalTwin.decayCurve
    .map((p, i) => toCoords(i, p.ambientQuality))
    .join(' ');
  const coldPoints = digitalTwin.decayCurve
    .map((p, i) => toCoords(i, p.coldQuality))
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#D4D9D0] rounded-lg hover:bg-[#F7F8F6]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isHi ? 'डैशबोर्ड' : 'Back'}
          </button>

          <select
            aria-label="Select active batch"
            value={batch.id}
            onChange={(e) => onSelectBatchId(e.target.value)}
            className="px-3 py-1.5 text-sm font-medium bg-white border border-[#D4D9D0] rounded-lg"
          >
            {allBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.crop} ({b.quantityKg} kg)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenSimulator(batch.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#D4D9D0] rounded-lg hover:bg-[#F7F8F6] whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5" />
            {t(language, 'navSimulator')}
          </button>
          <button
            type="button"
            onClick={() => onOpenAssist(batch.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#D4D9D0] rounded-lg hover:bg-[#F7F8F6] whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t(language, 'navAssist')}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#D4D9D0] rounded-lg hover:bg-[#F7F8F6] whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isHi ? 'संपादित करें' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#D4D9D0] text-red-700 rounded-lg hover:bg-red-50 whitespace-nowrap"
          >
            <Archive className="w-3.5 h-3.5" />
            {isHi ? 'आर्काइव' : 'Archive'}
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-xl">
          {feedbackMsg}
        </div>
      )}

      {/* Inline Edit Panel */}
      {editing && (
        <form
          onSubmit={handleSaveEdit}
          className="bg-white border border-[#E2E6DF] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label htmlFor="edit-qty" className="block text-xs font-medium text-[#4B554D] mb-1">
              {t(language, 'quantityKg')}
            </label>
            <input
              id="edit-qty"
              type="number"
              min="1"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-[#D4D9D0] rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="edit-temp" className="block text-xs font-medium text-[#4B554D] mb-1">
              {t(language, 'ambientTemp')}
            </label>
            <input
              id="edit-temp"
              type="number"
              step="0.5"
              value={editTemp}
              onChange={(e) => setEditTemp(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-[#D4D9D0] rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="edit-storage" className="block text-xs font-medium text-[#4B554D] mb-1">
              {t(language, 'storageMode')}
            </label>
            <select
              id="edit-storage"
              value={editStorage}
              onChange={(e) => setEditStorage(e.target.value as 'ambient' | 'cold')}
              className="w-full px-3 py-2 text-sm border border-[#D4D9D0] rounded-lg"
            >
              <option value="ambient">{t(language, 'ambientStorage')}</option>
              <option value="cold">{t(language, 'coldStorage')}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
          >
            {isHi ? 'सहेजें और पुनर्गणना करें' : 'Save & Recompute'}
          </button>
        </form>
      )}

      {/* Digital Twin Profile + 72h Decay Curve */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#647066]">
                {isHi ? 'बैच डिजिटल ट्विन' : 'Live Batch Digital Twin'}
              </div>
              <h1 className="font-display text-xl font-bold text-[#141A15] mt-0.5">
                {batch.crop} · {batch.id}
              </h1>
              <p className="text-xs text-[#647066] mt-1 tabular-nums">
                {batch.farmerName} · {batch.locality} ·{' '}
                {batch.quantityKg.toLocaleString('en-IN')} kg
              </p>
            </div>

            <div className={`text-xs font-semibold ${riskColor}`}>
              {getRiskLabel(language, digitalTwin.riskLevel)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E2E6DF]">
            <div>
              <div className="text-xs text-[#647066]">{t(language, 'qualityScore')}</div>
              <div className="font-mono text-2xl font-bold text-[#141A15] mt-0.5 tabular-nums">
                {digitalTwin.qualityScore}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#647066]">{t(language, 'spoilageRisk')}</div>
              <div className={`font-mono text-2xl font-bold mt-0.5 tabular-nums ${riskColor}`}>
                {digitalTwin.spoilageRisk}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#647066]">{t(language, 'shelfLifeRemaining')}</div>
              <div className="font-mono text-lg font-semibold text-[#141A15] mt-0.5 tabular-nums">
                {digitalTwin.remainingShelfLifeHours} {t(language, 'hours')}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#647066]">
                {isHi ? 'कटाई के बाद बीता समय' : 'Elapsed / Temp Factor'}
              </div>
              <div className="font-mono text-sm font-semibold text-[#141A15] mt-1 tabular-nums flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-[#647066]" />
                {digitalTwin.hoursElapsed}h · Q10 ×{digitalTwin.temperatureFactor}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E6DF] flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirmAction(batch.id, recommendation.recommendedAction)}
              className="flex-1 py-2.5 px-4 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
            >
              {batch.status === 'action_confirmed'
                ? `${t(language, 'actionConfirmed')}: ${getActionLabel(
                    language,
                    batch.confirmedAction ?? recommendation.recommendedAction
                  )}`
                : `${t(language, 'confirmAction')}: ${getActionLabel(
                    language,
                    recommendation.recommendedAction
                  )}`}
            </button>
            <button
              type="button"
              onClick={() => setShowOutcomeForm((v) => !v)}
              className="py-2.5 px-3.5 bg-white border border-[#D4D9D0] text-xs font-medium text-[#141A15] rounded-lg hover:bg-[#F7F8F6]"
            >
              {t(language, 'logOutcome')}
            </button>
          </div>
        </div>

        {/* 72-Hour Quality Trajectory SVG */}
        <div className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E6DF]">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#141A15]">
                {isHi
                  ? '72-घंटे गुणवत्ता क्षय वक्र (सामान्य बनाम कोल्ड स्टोरेज)'
                  : '72-Hour Quality Decay Projection (Ambient vs Cold Storage)'}
              </h2>
              <p className="text-xs text-[#647066]">
                Q10 rule-based shelf-life curve · Effective shelf life{' '}
                <span className="font-mono tabular-nums">{digitalTwin.effectiveShelfLifeHours}h</span>
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#4B554D]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-700 inline-block" /> Cold Storage
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-600 inline-block" /> Ambient ({batch.ambientTempC}°C)
              </span>
            </div>
          </div>

          <div className="mt-4">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-44 overflow-visible"
              role="img"
              aria-label="72-hour quality decay projection chart"
            >
              {[0, 30, 65, 100].map((val) => {
                const y = padY + ((100 - val) / 100) * plotH;
                return (
                  <g key={val}>
                    <line
                      x1={padX}
                      y1={y}
                      x2={svgW - padX}
                      y2={y}
                      stroke={val === 30 ? '#FECACA' : '#E2E6DF'}
                      strokeDasharray={val === 30 ? '4 4' : undefined}
                      strokeWidth="1"
                    />
                    <text
                      x={padX - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-[#647066] text-[10px] font-mono"
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              <polyline
                fill="none"
                stroke="#15803D"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={coldPoints}
              />
              <polyline
                fill="none"
                stroke="#D97706"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={ambientPoints}
              />

              {digitalTwin.decayCurve.map((pt, i) => {
                const x =
                  padX + (i / Math.max(1, digitalTwin.decayCurve.length - 1)) * plotW;
                return (
                  <text
                    key={pt.hourOffset}
                    x={x}
                    y={svgH - 2}
                    textAnchor="middle"
                    className="fill-[#647066] text-[10px] font-mono"
                  >
                    +{pt.hourOffset}h
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="mt-2 text-xs text-[#647066]">
            {isHi
              ? 'लाल डैश्ड रेखा (30% गुणवत्ता = 70% खराबी जोखिम) गंभीर चेतावनी सीमा दर्शाती है।'
              : 'Red dashed threshold at 30% quality indicates the 70% critical spoilage risk alert boundary.'}
          </div>
        </div>
      </section>

      {/* Log Final Disposition / Actual Outcome (FR-4.4) */}
      {showOutcomeForm && (
        <form
          onSubmit={handleOutcomeSubmit}
          className="bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-[#141A15]">
            {isHi
              ? 'वास्तविक परिणाम दर्ज करें (मॉडल सटीकता सुधार के लिए)'
              : 'Record Final Batch Disposition & Actual Value Realised'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="out-action" className="block text-xs font-medium text-[#4B554D] mb-1">
                Actual Action Taken
              </label>
              <select
                id="out-action"
                value={actualAction}
                onChange={(e) => setActualAction(e.target.value as ActionType)}
                className="w-full px-3 py-2 text-sm border border-[#D4D9D0] rounded-lg"
              >
                <option value="sell">Sell</option>
                <option value="store">Store</option>
                <option value="process">Process</option>
                <option value="redirect">Redirect</option>
              </select>
            </div>
            <div>
              <label htmlFor="out-value" className="block text-xs font-medium text-[#4B554D] mb-1">
                Actual Net Value Realised (₹)
              </label>
              <input
                id="out-value"
                type="number"
                required
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-[#D4D9D0] rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="out-spoil" className="block text-xs font-medium text-[#4B554D] mb-1">
                Observed Spoilage (%)
              </label>
              <input
                id="out-spoil"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={actualSpoilage}
                onChange={(e) => setActualSpoilage(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-[#D4D9D0] rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOutcomeForm(false)}
              className="px-4 py-2 text-xs font-medium border border-[#D4D9D0] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
            >
              Submit Outcome
            </button>
          </div>
        </form>
      )}

      {/* Decision Engine Auditable Formula Breakdown (FR-7.1 to FR-7.5) */}
      <section className="bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E2E6DF]">
          <div className="flex-1 min-w-[260px]">
            <h2 className="font-display text-lg font-semibold text-[#141A15]">
              {t(language, 'formulaBreakdown')}
            </h2>
            <p className="text-sm text-[#4B554D] mt-0.5">
              {isHi ? recommendation.explanationHi : recommendation.explanationEn}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateBatch(batch.id, {})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#F7F8F6] border border-[#D4D9D0] rounded-lg hover:bg-[#F1F3EF] whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t(language, 'recompute')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E6DF] text-xs font-semibold text-[#647066]">
                <th className="py-2.5 pr-4">Action</th>
                <th className="py-2.5 px-4">SRS Formula & Live Values</th>
                <th className="py-2.5 px-4 text-right">Gross (₹)</th>
                <th className="py-2.5 px-4 text-right">Costs (₹)</th>
                <th className="py-2.5 pl-4 text-right">Expected Net (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6DF] text-sm">
              {[...recommendation.options]
                .sort((a, b) => b.expectedNetValue - a.expectedNetValue)
                .map((opt) => {
                  const isWinner = opt.action === recommendation.recommendedAction;
                  return (
                    <tr
                      key={opt.action}
                      className={isWinner ? 'bg-emerald-50/60' : 'hover:bg-[#F7F8F6]'}
                    >
                      <td className="py-3.5 pr-4 align-top">
                        <div className="flex items-center gap-2 font-semibold text-[#141A15]">
                          {isWinner && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
                          <span>{getActionLabel(language, opt.action)}</span>
                        </div>
                        {isWinner && (
                          <div className="text-xs font-medium text-emerald-800 mt-0.5">
                            Recommended
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <div className="text-xs text-[#4B554D]">{opt.formulaText}</div>
                        <div className="font-mono text-xs text-[#141A15] mt-1 tabular-nums">
                          {opt.formulaValuesText}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums align-top text-[#4B554D]">
                        ₹{opt.grossRevenue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums align-top text-[#4B554D]">
                        −₹{opt.totalCosts.toLocaleString('en-IN')}
                      </td>
                      <td
                        className={`py-3.5 pl-4 text-right font-mono font-semibold tabular-nums align-top ${
                          isWinner ? 'text-emerald-800' : 'text-[#141A15]'
                        }`}
                      >
                        ₹{opt.expectedNetValue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
