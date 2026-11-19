import {
  ActionType,
  Batch,
  BatchRecommendation,
  Cluster,
  CropConstant,
  DecisionFormulaInputs,
  DecisionOption,
  DigitalTwinProfile,
  EnrichedBatch,
  MarketPrice,
  RiskLevel,
} from '../types';

export interface WhatIfParams {
  transportDelayHours: number;
  storageDays: number;
  storageMode: 'ambient' | 'cold';
  priceTrendDeltaPct: number;
  clusterPoolSize: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * SRS Section 5.3.1:
 * - Temperature factor uses a Q10-style heuristic: decay rate roughly doubles for every 10°C rise above 20°C baseline.
 * - effective_shelf_life = crop_base_shelf_life / temperature_factor
 * - quality(t) = 100 * (1 - hours_elapsed / effective_shelf_life) scaled by initial quality baseline
 * - spoilage_risk = 100 - quality(t)
 */
export function computeTemperatureFactor(temperatureC: number): number {
  const raw = Math.pow(2, (temperatureC - 20) / 10);
  return round2(clamp(raw, 0.25, 6.0));
}

export function computeQualityAtTime(
  cropConstant: CropConstant,
  hoursElapsed: number,
  temperatureC: number,
  initialQuality?: number
): {
  qualityScore: number;
  spoilageRisk: number;
  remainingShelfLifeHours: number;
  effectiveShelfLifeHours: number;
  temperatureFactor: number;
} {
  const safeHours = Math.max(0, hoursElapsed);
  const startQuality = clamp(initialQuality ?? cropConstant.defaultInitialQuality, 10, 100);
  const temperatureFactor = computeTemperatureFactor(temperatureC);
  const effectiveShelfLifeHours = round2(cropConstant.baseShelfLifeHours / temperatureFactor);
  const decayFraction = clamp(safeHours / effectiveShelfLifeHours, 0, 1);
  const qualityScore = round2(clamp(startQuality * (1 - decayFraction), 0, 100));
  const spoilageRisk = round2(clamp(100 - qualityScore, 0, 100));
  const remainingShelfLifeHours = round2(Math.max(0, effectiveShelfLifeHours - safeHours));

  return {
    qualityScore,
    spoilageRisk,
    remainingShelfLifeHours,
    effectiveShelfLifeHours,
    temperatureFactor,
  };
}

export function classifyRiskLevel(spoilageRisk: number, highThreshold = 70): RiskLevel {
  if (spoilageRisk >= highThreshold) return 'high';
  if (spoilageRisk >= 35) return 'medium';
  return 'low';
}

export function computeDigitalTwin(
  batch: Batch,
  cropConstant: CropConstant,
  nowMs: number = Date.now(),
  highRiskThreshold = 70
): DigitalTwinProfile {
  const harvestMs = new Date(batch.harvestTime).getTime();
  const hoursElapsed = round2(Math.max(0, (nowMs - harvestMs) / (1000 * 60 * 60)));
  const activeTemp = batch.storageMode === 'cold' ? cropConstant.coldStorageTempC : batch.ambientTempC;

  const current = computeQualityAtTime(cropConstant, hoursElapsed, activeTemp, batch.initialQuality);
  const riskLevel = classifyRiskLevel(current.spoilageRisk, highRiskThreshold);

  const offsets = [0, 12, 24, 36, 48, 60, 72];
  const decayCurve = offsets.map((hourOffset) => {
    const ambient = computeQualityAtTime(
      cropConstant,
      hoursElapsed + hourOffset,
      batch.ambientTempC,
      batch.initialQuality
    );
    const cold = computeQualityAtTime(
      cropConstant,
      hoursElapsed + hourOffset,
      cropConstant.coldStorageTempC,
      batch.initialQuality
    );
    return {
      hourOffset,
      ambientQuality: ambient.qualityScore,
      coldQuality: cold.qualityScore,
    };
  });

  return {
    qualityScore: current.qualityScore,
    spoilageRisk: current.spoilageRisk,
    remainingShelfLifeHours: current.remainingShelfLifeHours,
    effectiveShelfLifeHours: current.effectiveShelfLifeHours,
    hoursElapsed,
    temperatureFactor: current.temperatureFactor,
    riskLevel,
    decayCurve,
  };
}

/**
 * SRS Section 5.3.2: Decision (Optimization) Engine
 * - Sell now = quantity * fresh_price * quality_factor - transport_cost
 * - Store = quantity * projected_price * projected_quality_factor - storage_cost - transport_cost
 * - Process = quantity * processing_rate - processing_cost
 * - Redirect = quantity * alternate_market_price * quality_factor - pooled_transport_cost - redirect_cost
 */
export function computeDecisionRecommendation(
  batch: Batch,
  digitalTwin: DigitalTwinProfile,
  cropConstant: CropConstant,
  marketPrices: MarketPrice[],
  overrides?: {
    transportDelayHours?: number;
    storageDays?: number;
    storageMode?: 'ambient' | 'cold';
    priceTrendDeltaPct?: number;
    clusterPoolSize?: number;
    nowIso?: string;
  }
): BatchRecommendation {
  const cropPrices = marketPrices.filter(
    (m) => m.crop.toLowerCase() === batch.crop.toLowerCase()
  );

  const localPrice =
    cropPrices.find((m) => m.locality.toLowerCase() === batch.locality.toLowerCase()) ??
    cropPrices[0] ?? {
      mandi: `${batch.locality} Local Mandi`,
      locality: batch.locality,
      pricePerKg: 24,
      previousPricePerKg: 24,
      trend: 'flat' as const,
      changePct: 0,
    };

  // Alternate mandi with highest price for redirect
  const sortedByPrice = [...cropPrices].sort((a, b) => b.pricePerKg - a.pricePerKg);
  const alternatePriceObj =
    sortedByPrice.find((m) => m.mandi !== localPrice.mandi) ?? {
      mandi: 'Regional Terminal Mandi',
      pricePerKg: round2(localPrice.pricePerKg * 1.14),
    };

  const priceDeltaMultiplier = 1 + (overrides?.priceTrendDeltaPct ?? 0) / 100;
  const freshPricePerKg = round2(localPrice.pricePerKg * priceDeltaMultiplier);
  const alternatePricePerKg = round2(
    Math.max(alternatePriceObj.pricePerKg, localPrice.pricePerKg * 1.12) * priceDeltaMultiplier
  );

  const transportDelayHours = overrides?.transportDelayHours ?? 0;
  const storageDays = overrides?.storageDays ?? 3;
  const storageTemp =
    (overrides?.storageMode ?? 'cold') === 'cold'
      ? cropConstant.coldStorageTempC
      : batch.ambientTempC;

  // Quality after transit delay for immediate sell / redirect
  const sellQuality =
    transportDelayHours > 0
      ? computeQualityAtTime(
          cropConstant,
          digitalTwin.hoursElapsed + transportDelayHours,
          batch.ambientTempC,
          batch.initialQuality
        ).qualityScore
      : digitalTwin.qualityScore;

  // Quality after storageDays in chosen storage mode
  const projectedStorageMetrics = computeQualityAtTime(
    cropConstant,
    digitalTwin.hoursElapsed + storageDays * 24,
    storageTemp,
    batch.initialQuality
  );

  const trendBonusPct =
    localPrice.trend === 'rising' ? 0.08 : localPrice.trend === 'falling' ? -0.06 : 0.02;
  const projectedPricePerKg = round2(
    freshPricePerKg * (1 + trendBonusPct * (storageDays / 3))
  );

  const qualityFactor = round2(sellQuality / 100);
  const projectedQualityFactor = round2(projectedStorageMetrics.qualityScore / 100);

  const poolSize = overrides?.clusterPoolSize ?? (batch.clusterId ? 3 : 1);
  const poolDiscountFactor = poolSize > 1 ? Math.max(0.55, 1 - 0.12 * (poolSize - 1)) : 1;

  const transportCost = round2(batch.quantityKg * cropConstant.individualTransportRatePerKg);
  const pooledTransportCost = round2(
    batch.quantityKg * cropConstant.pooledTransportRatePerKg * poolDiscountFactor
  );
  const storageCost = round2(
    batch.quantityKg * cropConstant.storageCostPerKgPerDay * storageDays
  );
  const processingCost = round2(batch.quantityKg * cropConstant.processingCostPerKg);
  const redirectCost = round2(batch.quantityKg * cropConstant.redirectExtraCostPerKg);

  const sellGross = round2(batch.quantityKg * freshPricePerKg * qualityFactor);
  const sellNet = round2(sellGross - transportCost);

  const storeGross = round2(batch.quantityKg * projectedPricePerKg * projectedQualityFactor);
  const storeNet = round2(storeGross - storageCost - transportCost);

  // If quality drops below 45%, processing rate suffers slightly less than fresh mandi rejection
  const processQualityMultiplier = sellQuality >= 40 ? 1 : 0.85;
  const processGross = round2(
    batch.quantityKg * cropConstant.processingRatePerKg * processQualityMultiplier
  );
  const processNet = round2(processGross - processingCost);

  const redirectGross = round2(batch.quantityKg * alternatePricePerKg * qualityFactor);
  const redirectNet = round2(redirectGross - pooledTransportCost - redirectCost);

  const inputs: DecisionFormulaInputs = {
    quantityKg: batch.quantityKg,
    freshPricePerKg,
    projectedPricePerKg,
    alternatePricePerKg,
    processingRatePerKg: round2(cropConstant.processingRatePerKg * processQualityMultiplier),
    qualityFactor,
    projectedQualityFactor,
    transportCost,
    pooledTransportCost,
    storageCost,
    processingCost,
    redirectCost,
    storageDaysAssumed: storageDays,
    primaryMandiName: localPrice.mandi,
    alternateMandiName: alternatePriceObj.mandi,
  };

  const options: DecisionOption[] = [
    {
      action: 'sell',
      expectedNetValue: sellNet,
      grossRevenue: sellGross,
      totalCosts: transportCost,
      formulaText: 'quantity × fresh price × quality factor − transport cost',
      formulaValuesText: `${inputs.quantityKg} × ₹${inputs.freshPricePerKg} × ${inputs.qualityFactor} − ₹${inputs.transportCost}`,
    },
    {
      action: 'store',
      expectedNetValue: storeNet,
      grossRevenue: storeGross,
      totalCosts: round2(storageCost + transportCost),
      formulaText: 'quantity × projected price × projected quality factor − storage cost − transport cost',
      formulaValuesText: `${inputs.quantityKg} × ₹${inputs.projectedPricePerKg} × ${inputs.projectedQualityFactor} − ₹${inputs.storageCost} − ₹${inputs.transportCost}`,
    },
    {
      action: 'process',
      expectedNetValue: processNet,
      grossRevenue: processGross,
      totalCosts: processingCost,
      formulaText: 'quantity × processing rate − processing cost',
      formulaValuesText: `${inputs.quantityKg} × ₹${inputs.processingRatePerKg} − ₹${inputs.processingCost}`,
    },
    {
      action: 'redirect',
      expectedNetValue: redirectNet,
      grossRevenue: redirectGross,
      totalCosts: round2(pooledTransportCost + redirectCost),
      formulaText: 'quantity × alternate-market price × quality factor − pooled transport cost − redirect cost',
      formulaValuesText: `${inputs.quantityKg} × ₹${inputs.alternatePricePerKg} × ${inputs.qualityFactor} − ₹${inputs.pooledTransportCost} − ₹${inputs.redirectCost}`,
    },
  ];

  const sortedOptions = [...options].sort((a, b) => b.expectedNetValue - a.expectedNetValue);
  const winner = sortedOptions[0];
  const runnerUp = sortedOptions[1];
  const margin = round2(winner.expectedNetValue - runnerUp.expectedNetValue);

  const actionLabelsEn: Record<ActionType, string> = {
    sell: `Sell immediately at ${inputs.primaryMandiName}`,
    store: `Store in cold storage for ${storageDays} days`,
    process: `Send for agro-processing`,
    redirect: `Redirect via cluster pool to ${inputs.alternateMandiName}`,
  };

  const actionLabelsHi: Record<ActionType, string> = {
    sell: `${inputs.primaryMandiName} में तुरंत बेचें`,
    store: `${storageDays} दिनों के लिए कोल्ड स्टोरेज में भंडारण करें`,
    process: `प्रसंस्करण (प्रोसेसिंग) इकाई को भेजें`,
    redirect: `क्लस्टर पूल से ${inputs.alternateMandiName} भेजें`,
  };

  const explanationEn = `${actionLabelsEn[winner.action]} yields the highest expected net value of ₹${winner.expectedNetValue.toLocaleString('en-IN')} (₹${margin.toLocaleString('en-IN')} above ${runnerUp.action.toUpperCase()}). Current batch quality is ${sellQuality}% with ${digitalTwin.remainingShelfLifeHours}h remaining shelf life.`;

  const explanationHi = `${actionLabelsHi[winner.action]} से अधिकतम ₹${winner.expectedNetValue.toLocaleString('en-IN')} शुद्ध लाभ अनुमानित है (दूसरे विकल्प से ₹${margin.toLocaleString('en-IN')} अधिक)। वर्तमान गुणवत्ता ${sellQuality}% और शेष शेल्फ-लाइफ ${digitalTwin.remainingShelfLifeHours} घंटे है।`;

  return {
    recommendedAction: winner.action,
    expectedValue: winner.expectedNetValue,
    options,
    inputs,
    explanationEn,
    explanationHi,
    generatedAt: overrides?.nowIso ?? new Date().toISOString(),
  };
}

export function enrichBatch(
  batch: Batch,
  cropConstants: CropConstant[],
  marketPrices: MarketPrice[],
  nowMs: number = Date.now(),
  highRiskThreshold = 70
): EnrichedBatch {
  const cropConstant =
    cropConstants.find((c) => c.crop.toLowerCase() === batch.crop.toLowerCase()) ??
    cropConstants[0];

  const digitalTwin = computeDigitalTwin(batch, cropConstant, nowMs, highRiskThreshold);
  const recommendation = computeDecisionRecommendation(
    batch,
    digitalTwin,
    cropConstant,
    marketPrices,
    {
      storageMode: batch.storageMode,
      nowIso: new Date(nowMs).toISOString(),
    }
  );

  return {
    ...batch,
    digitalTwin,
    recommendation,
  };
}

export function simulateWhatIf(
  batch: EnrichedBatch,
  cropConstant: CropConstant,
  marketPrices: MarketPrice[],
  params: WhatIfParams
): {
  simulatedQuality: number;
  simulatedSpoilageRisk: number;
  recommendation: BatchRecommendation;
} {
  const effectiveTemp =
    params.storageMode === 'cold' ? cropConstant.coldStorageTempC : batch.ambientTempC;

  const afterStorage = computeQualityAtTime(
    cropConstant,
    batch.digitalTwin.hoursElapsed + params.transportDelayHours + params.storageDays * 24,
    effectiveTemp,
    batch.initialQuality
  );

  const recommendation = computeDecisionRecommendation(
    batch,
    batch.digitalTwin,
    cropConstant,
    marketPrices,
    {
      transportDelayHours: params.transportDelayHours,
      storageDays: params.storageDays,
      storageMode: params.storageMode,
      priceTrendDeltaPct: params.priceTrendDeltaPct,
      clusterPoolSize: params.clusterPoolSize,
    }
  );

  return {
    simulatedQuality: afterStorage.qualityScore,
    simulatedSpoilageRisk: afterStorage.spoilageRisk,
    recommendation,
  };
}

export function computeClusterMetrics(
  batches: EnrichedBatch[],
  cropConstant: CropConstant,
  harvestWindowHours: number
): {
  totalQuantityKg: number;
  avgQualityScore: number;
  individualTransportCostPerKg: number;
  pooledTransportCostPerKg: number;
  totalTransportSavingsInr: number;
} {
  const totalQuantityKg = batches.reduce((sum, b) => sum + b.quantityKg, 0);
  const avgQualityScore =
    batches.length > 0
      ? round2(
          batches.reduce((sum, b) => sum + b.digitalTwin.qualityScore * b.quantityKg, 0) /
            Math.max(1, totalQuantityKg)
        )
      : 0;

  const individualTransportCostPerKg = cropConstant.individualTransportRatePerKg;
  // Larger pool reduces per-kg cost smoothly down to 60% of individual cost
  const efficiencyBonus = Math.max(0.6, 1 - 0.1 * Math.max(0, batches.length - 1));
  const pooledTransportCostPerKg = round2(
    Math.min(cropConstant.pooledTransportRatePerKg, individualTransportCostPerKg * efficiencyBonus)
  );
  const totalTransportSavingsInr = round2(
    totalQuantityKg * (individualTransportCostPerKg - pooledTransportCostPerKg)
  );

  return {
    totalQuantityKg,
    avgQualityScore,
    individualTransportCostPerKg,
    pooledTransportCostPerKg,
    totalTransportSavingsInr,
  };
}

export function buildDynamicClusters(
  enrichedBatches: EnrichedBatch[],
  cropConstants: CropConstant[],
  existingClusters: Cluster[],
  harvestWindowHours = 48
): Cluster[] {
  const active = enrichedBatches.filter(
    (b) => b.status === 'active' || b.status === 'action_confirmed'
  );

  const groups = new Map<string, EnrichedBatch[]>();
  for (const batch of active) {
    const key = `${batch.crop.toLowerCase()}::${batch.locality.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(batch);
    groups.set(key, list);
  }

  const result: Cluster[] = [];
  let idx = 1;

  for (const [, groupBatches] of groups.entries()) {
    // Check batches within harvestWindowHours of the earliest batch in the group
    const sorted = [...groupBatches].sort(
      (a, b) => new Date(a.harvestTime).getTime() - new Date(b.harvestTime).getTime()
    );
    const anchorMs = new Date(sorted[0].harvestTime).getTime();
    const windowed = sorted.filter(
      (b) => (new Date(b.harvestTime).getTime() - anchorMs) / (1000 * 60 * 60) <= harvestWindowHours
    );

    if (windowed.length === 0) continue;

    const sample = windowed[0];
    const cropConstant =
      cropConstants.find((c) => c.crop.toLowerCase() === sample.crop.toLowerCase()) ??
      cropConstants[0];

    const existing = existingClusters.find(
      (c) =>
        c.crop.toLowerCase() === sample.crop.toLowerCase() &&
        c.locality.toLowerCase() === sample.locality.toLowerCase()
    );

    const metrics = computeClusterMetrics(windowed, cropConstant, harvestWindowHours);
    const id = existing?.id ?? `CLU-${String(idx).padStart(3, '0')}`;
    idx++;

    const storageSlotTotalKg = existing?.storageSlotTotalKg ?? 10000;
    const storageSlotAllocatedKg = Math.min(storageSlotTotalKg, metrics.totalQuantityKg);

    result.push({
      id,
      crop: sample.crop,
      locality: sample.locality,
      fpoId: sample.fpoId,
      batchIds: windowed.map((b) => b.id),
      farmerNames: Array.from(new Set(windowed.map((b) => b.farmerName))),
      totalQuantityKg: metrics.totalQuantityKg,
      avgQualityScore: metrics.avgQualityScore,
      individualTransportCostPerKg: metrics.individualTransportCostPerKg,
      pooledTransportCostPerKg: metrics.pooledTransportCostPerKg,
      totalTransportSavingsInr: metrics.totalTransportSavingsInr,
      storageFacilityName:
        existing?.storageFacilityName ?? `${sample.locality} FPO Cold Hub`,
      storageSlotTotalKg,
      storageSlotAllocatedKg,
      harvestWindowHours,
      status: existing?.status ?? (windowed.length >= 2 ? 'candidate' : 'candidate'),
      buyerInterests: existing?.buyerInterests ?? [],
      confirmedAt: existing?.confirmedAt,
    });
  }

  return result;
}
