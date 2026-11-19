import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRiskLevel,
  computeClusterMetrics,
  computeDecisionRecommendation,
  computeDigitalTwin,
  computeQualityAtTime,
  computeTemperatureFactor,
  simulateWhatIf,
} from './prediction';
import { Batch, CropConstant, MarketPrice } from '../types';

const tomatoCrop: CropConstant = {
  crop: 'Tomato',
  cropHi: 'टमाटर',
  baseShelfLifeHours: 120,
  defaultInitialQuality: 96,
  defaultAmbientTempC: 28,
  coldStorageTempC: 10,
  processingRatePerKg: 18,
  processingCostPerKg: 2.5,
  storageCostPerKgPerDay: 1.2,
  individualTransportRatePerKg: 3.5,
  pooledTransportRatePerKg: 2.1,
  redirectExtraCostPerKg: 0.8,
};

const sampleMarketPrices: MarketPrice[] = [
  {
    id: 'mp-1',
    crop: 'Tomato',
    mandi: 'Pimpalgaon APMC',
    locality: 'Nashik',
    pricePerKg: 22,
    previousPricePerKg: 20,
    trend: 'rising',
    changePct: 10,
    arrivalsTonnes: 140,
    source: 'Agmarknet',
    fetchedAt: '2026-11-19T06:00:00Z',
  },
  {
    id: 'mp-2',
    crop: 'Tomato',
    mandi: 'Vashi APMC Mumbai',
    locality: 'Mumbai',
    pricePerKg: 31,
    previousPricePerKg: 29,
    trend: 'rising',
    changePct: 6.9,
    arrivalsTonnes: 210,
    source: 'eNAM',
    fetchedAt: '2026-11-19T06:00:00Z',
  },
];

const nowMs = new Date('2026-11-19T12:00:00Z').getTime();

const freshBatch: Batch = {
  id: 'B-101',
  farmerId: 'u-farmer-1',
  farmerName: 'Ramesh Patil',
  fpoId: 'fpo-1',
  crop: 'Tomato',
  quantityKg: 1000,
  harvestTime: '2026-11-19T06:00:00Z', // 6 hours elapsed
  locality: 'Nashik',
  ambientTempC: 20, // exact baseline
  initialQuality: 100,
  storageMode: 'ambient',
  status: 'active',
  createdAt: '2026-11-19T06:00:00Z',
  updatedAt: '2026-11-19T06:00:00Z',
};

test('Q10 temperature factor doubles at 30C vs 20C baseline', () => {
  assert.equal(computeTemperatureFactor(20), 1);
  assert.equal(computeTemperatureFactor(30), 2);
  assert.equal(computeTemperatureFactor(10), 0.5);
});

test('quality(t) and spoilage_risk follow SRS 5.3.1 exact formula', () => {
  // At 20C, effective_shelf_life = 120h. After 60h, quality = 50, spoilage_risk = 50
  const res = computeQualityAtTime(tomatoCrop, 60, 20, 100);
  assert.equal(res.effectiveShelfLifeHours, 120);
  assert.equal(res.qualityScore, 50);
  assert.equal(res.spoilageRisk, 50);
  assert.equal(res.remainingShelfLifeHours, 60);

  // At 30C, temperature_factor = 2, effective_shelf_life = 60h. After 45h, quality = 25, spoilage_risk = 75 (high!)
  const hotRes = computeQualityAtTime(tomatoCrop, 45, 30, 100);
  assert.equal(hotRes.effectiveShelfLifeHours, 60);
  assert.equal(hotRes.qualityScore, 25);
  assert.equal(hotRes.spoilageRisk, 75);
  assert.equal(classifyRiskLevel(hotRes.spoilageRisk), 'high');
});

test('Decision Engine computes all 4 SRS action values and picks highest', () => {
  const twin = computeDigitalTwin(freshBatch, tomatoCrop, nowMs);
  const rec = computeDecisionRecommendation(
    freshBatch,
    twin,
    tomatoCrop,
    sampleMarketPrices
  );
  assert.equal(rec.options.length, 4);
  const actions = rec.options.map((o) => o.action);
  assert.deepEqual(actions, ['sell', 'store', 'process', 'redirect']);

  const maxOpt = rec.options.reduce((a, b) =>
    b.expectedNetValue > a.expectedNetValue ? b : a
  );
  assert.equal(rec.recommendedAction, maxOpt.action);
  assert.equal(rec.expectedValue, maxOpt.expectedNetValue);
  // With Vashi APMC at ₹31/kg and pooled transport ₹2.1/kg, redirect should beat local sell at ₹22/kg
  assert.equal(rec.recommendedAction, 'redirect');
});

test('What-If simulator responds dynamically to transport delay and price crash', () => {
  const twin = computeDigitalTwin(freshBatch, tomatoCrop, nowMs);
  const rec = computeDecisionRecommendation(freshBatch, twin, tomatoCrop, sampleMarketPrices);
  const enriched = { ...freshBatch, digitalTwin: twin, recommendation: rec };

  const baselineSim = simulateWhatIf(enriched, tomatoCrop, sampleMarketPrices, {
    transportDelayHours: 0,
    storageDays: 3,
    storageMode: 'cold',
    priceTrendDeltaPct: 0,
    clusterPoolSize: 3,
  });

  const crashedSim = simulateWhatIf(enriched, tomatoCrop, sampleMarketPrices, {
    transportDelayHours: 36,
    storageDays: 0,
    storageMode: 'ambient',
    priceTrendDeltaPct: -30,
    clusterPoolSize: 1,
  });

  assert.ok(crashedSim.simulatedQuality < baselineSim.simulatedQuality);
  assert.ok(crashedSim.recommendation.expectedValue < baselineSim.recommendation.expectedValue);
});

test('Cluster pooling computes positive transport cost savings per kg', () => {
  const twin = computeDigitalTwin(freshBatch, tomatoCrop, nowMs);
  const rec = computeDecisionRecommendation(freshBatch, twin, tomatoCrop, sampleMarketPrices);
  const enriched1 = { ...freshBatch, digitalTwin: twin, recommendation: rec };
  const enriched2 = { ...enriched1, id: 'B-102', quantityKg: 1500 };

  const metrics = computeClusterMetrics([enriched1, enriched2], tomatoCrop, 48);
  assert.equal(metrics.totalQuantityKg, 2500);
  assert.ok(metrics.pooledTransportCostPerKg < metrics.individualTransportCostPerKg);
  assert.ok(metrics.totalTransportSavingsInr > 0);
});
