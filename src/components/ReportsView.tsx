import React from 'react';
import { Download, Printer } from 'lucide-react';
import { Language, Outcome } from '../types';
import { getActionLabel, t } from '../utils/i18n';

interface ReportsViewProps {
  language: Language;
  summary: {
    totalBatches: number;
    activeBatchesCount: number;
    completedOutcomesCount: number;
    totalActiveKg: number;
    totalExpectedValueInr: number;
    totalRealisedValueInr: number;
    estimatedLossAvoidedInr: number;
    totalTransportSavingsInr: number;
  };
  outcomes: Outcome[];
  transportComparison: Array<{
    clusterId: string;
    crop: string;
    locality: string;
    totalKg: number;
    individualCostInr: number;
    pooledCostInr: number;
    savingsInr: number;
  }>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  language,
  summary,
  outcomes,
  transportComparison,
}) => {
  const isHi = language === 'hi';

  function handleExportCsv() {
    const headers = [
      'RecordType',
      'ID',
      'Crop',
      'QuantityKg',
      'PredictedOrIndividualValueINR',
      'ActualOrPooledValueINR',
      'SavingsOrSpoilage',
    ];
    const rows: string[][] = [headers];

    for (const tc of transportComparison) {
      rows.push([
        'TransportComparison',
        tc.clusterId,
        tc.crop,
        String(tc.totalKg),
        String(tc.individualCostInr),
        String(tc.pooledCostInr),
        `Savings INR ${tc.savingsInr}`,
      ]);
    }
    for (const o of outcomes) {
      rows.push([
        'BatchOutcome',
        o.batchId,
        o.crop,
        String(o.quantityKg),
        String(o.predictedValueInr),
        String(o.actualValueRealisedInr),
        `Spoilage ${o.actualSpoilagePct}%`,
      ]);
    }

    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrinexus-fpo-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141A15]">
            {t(language, 'navReports')}
          </h1>
          <p className="text-sm text-[#4B554D] mt-1">
            {isHi
              ? 'FPO समग्र प्रदर्शन, परिवहन बचत तुलना और अनुमानित बनाम वास्तविक परिणाम'
              : 'FPO aggregate performance: batches handled, value realised, spoilage loss avoided, and pooled transport savings.'}
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#D4D9D0] text-xs font-semibold text-[#141A15] rounded-lg hover:bg-[#F7F8F6]"
          >
            <Download className="w-3.5 h-3.5" />
            {t(language, 'exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
          >
            <Printer className="w-3.5 h-3.5" />
            {t(language, 'exportPdf')}
          </button>
        </div>
      </div>

      {/* Aggregate KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs text-[#647066]">Batches Handled</div>
          <div className="font-mono text-2xl font-bold text-[#141A15] mt-1.5 tabular-nums">
            {summary.totalBatches}
          </div>
          <div className="text-xs text-[#647066] mt-1 tabular-nums">
            {summary.activeBatchesCount} active · {summary.completedOutcomesCount} completed
          </div>
        </div>

        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs text-[#647066]">Value Realised (Logged)</div>
          <div className="font-mono text-2xl font-bold text-emerald-800 mt-1.5 tabular-nums">
            ₹{summary.totalRealisedValueInr.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#647066] mt-1 tabular-nums">
            Active pipeline: ₹{summary.totalExpectedValueInr.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs text-[#647066]">Estimated Loss Avoided</div>
          <div className="font-mono text-2xl font-bold text-emerald-800 mt-1.5 tabular-nums">
            ₹{summary.estimatedLossAvoidedInr.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#647066] mt-1">
            Optimal vs naive distressed sale
          </div>
        </div>

        <div className="bg-white border border-[#E2E6DF] rounded-xl p-5">
          <div className="text-xs text-[#647066]">Cluster Transport Savings</div>
          <div className="font-mono text-2xl font-bold text-[#141A15] mt-1.5 tabular-nums">
            ₹{summary.totalTransportSavingsInr.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-[#647066] mt-1">
            Across {transportComparison.length} active clusters
          </div>
        </div>
      </section>

      {/* Before/After Transport Cost Comparison (FR-10.3) */}
      <section className="bg-white border border-[#E2E6DF] rounded-xl p-6 space-y-5">
        <div>
          <h2 className="font-display text-base font-semibold text-[#141A15]">
            {isHi
              ? 'परिवहन लागत तुलना: व्यक्तिगत बनाम क्लस्टर-पूल'
              : 'Before / After Comparison: Individual vs Cluster-Pooled Transport Cost'}
          </h2>
          <p className="text-xs text-[#647066] mt-0.5">
            Direct per-cluster dispatch cost reduction achieved through FPO harvest-window pooling
          </p>
        </div>

        <div className="space-y-4">
          {transportComparison.map((tc) => {
            const maxCost = Math.max(1, tc.individualCostInr);
            const pooledWidth = Math.round((tc.pooledCostInr / maxCost) * 100);
            return (
              <div key={tc.clusterId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#141A15]">
                    {tc.clusterId} · {tc.crop} ({tc.locality}, {tc.totalKg.toLocaleString('en-IN')} kg)
                  </span>
                  <span className="font-mono tabular-nums text-emerald-800 font-semibold">
                    Saved ₹{tc.savingsInr.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
                    <span className="w-20 text-[#647066]">Individual</span>
                    <div className="flex-1 h-2.5 bg-[#F1F3EF] rounded overflow-hidden">
                      <div className="h-full bg-[#94A396] w-full" />
                    </div>
                    <span className="w-20 text-right text-[#4B554D]">
                      ₹{tc.individualCostInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
                    <span className="w-20 text-emerald-800 font-medium">Pooled</span>
                    <div className="flex-1 h-2.5 bg-[#F1F3EF] rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-700"
                        style={{ width: `${pooledWidth}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-emerald-800 font-semibold">
                      ₹{tc.pooledCostInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Predicted vs Actual Outcomes (FR-4.4) */}
      <section className="bg-white border border-[#E2E6DF] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#E2E6DF]">
          <h2 className="font-display text-base font-semibold text-[#141A15]">
            {isHi
              ? 'अनुमानित बनाम वास्तविक बैच परिणाम (मॉडल प्रशिक्षण डेटासेट)'
              : 'Predicted vs Actual Batch Outcomes (Model Feedback Log)'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E6DF] bg-[#F7F8F6] text-xs font-semibold text-[#647066]">
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4">Crop & Volume</th>
                <th className="py-3 px-4">Predicted Action</th>
                <th className="py-3 px-4">Actual Action</th>
                <th className="py-3 px-4 text-right">Predicted (₹)</th>
                <th className="py-3 px-4 text-right">Realised (₹)</th>
                <th className="py-3 px-4 text-right">Spoilage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6DF] text-sm">
              {outcomes.map((o) => (
                <tr key={o.id} className="hover:bg-[#F7F8F6]">
                  <td className="py-3 px-4 font-mono text-xs text-[#141A15]">{o.batchId}</td>
                  <td className="py-3 px-4">
                    {o.crop} ·{' '}
                    <span className="font-mono text-xs tabular-nums">{o.quantityKg} kg</span>
                  </td>
                  <td className="py-3 px-4 text-xs">{getActionLabel(language, o.predictedAction)}</td>
                  <td className="py-3 px-4 text-xs font-medium text-[#141A15]">
                    {getActionLabel(language, o.actualActionTaken)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4B554D]">
                    ₹{o.predictedValueInr.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-emerald-800">
                    ₹{o.actualValueRealisedInr.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-[#4B554D]">
                    {o.actualSpoilagePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
