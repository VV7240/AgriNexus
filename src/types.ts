export type UserRole = 'farmer' | 'fpo_admin' | 'buyer' | 'system_admin';
export type Language = 'en' | 'hi';
export type ActionType = 'sell' | 'store' | 'process' | 'redirect';
export type RiskLevel = 'low' | 'medium' | 'high';
export type BatchStatus = 'active' | 'action_confirmed' | 'archived' | 'completed';
export type PriceTrend = 'rising' | 'falling' | 'flat';

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: UserRole;
  fpoId: string;
  fpoName: string;
  locality: string;
  languagePreference: Language;
  approved: boolean;
  lockedUntil?: string | null;
  failedAttempts?: number;
  createdAt: string;
}

export interface CropConstant {
  crop: string;
  cropHi: string;
  baseShelfLifeHours: number;
  defaultInitialQuality: number;
  defaultAmbientTempC: number;
  coldStorageTempC: number;
  processingRatePerKg: number;
  processingCostPerKg: number;
  storageCostPerKgPerDay: number;
  individualTransportRatePerKg: number;
  pooledTransportRatePerKg: number;
  redirectExtraCostPerKg: number;
}

export interface MarketPrice {
  id: string;
  crop: string;
  mandi: string;
  locality: string;
  pricePerKg: number;
  previousPricePerKg: number;
  trend: PriceTrend;
  changePct: number;
  arrivalsTonnes: number;
  source: 'Agmarknet' | 'eNAM' | 'Admin Override';
  fetchedAt: string;
  overriddenBy?: string;
}

export interface DigitalTwinProfile {
  qualityScore: number;
  spoilageRisk: number;
  remainingShelfLifeHours: number;
  effectiveShelfLifeHours: number;
  hoursElapsed: number;
  temperatureFactor: number;
  riskLevel: RiskLevel;
  decayCurve: Array<{ hourOffset: number; ambientQuality: number; coldQuality: number }>;
}

export interface DecisionFormulaInputs {
  quantityKg: number;
  freshPricePerKg: number;
  projectedPricePerKg: number;
  alternatePricePerKg: number;
  processingRatePerKg: number;
  qualityFactor: number;
  projectedQualityFactor: number;
  transportCost: number;
  pooledTransportCost: number;
  storageCost: number;
  processingCost: number;
  redirectCost: number;
  storageDaysAssumed: number;
  alternateMandiName: string;
  primaryMandiName: string;
}

export interface DecisionOption {
  action: ActionType;
  expectedNetValue: number;
  grossRevenue: number;
  totalCosts: number;
  formulaText: string;
  formulaValuesText: string;
}

export interface BatchRecommendation {
  recommendedAction: ActionType;
  expectedValue: number;
  options: DecisionOption[];
  inputs: DecisionFormulaInputs;
  explanationEn: string;
  explanationHi: string;
  generatedAt: string;
}

export interface Batch {
  id: string;
  farmerId: string;
  farmerName: string;
  fpoId: string;
  crop: string;
  quantityKg: number;
  harvestTime: string;
  locality: string;
  ambientTempC: number;
  initialQuality: number;
  storageMode: 'ambient' | 'cold';
  photoDataUrl?: string;
  notes?: string;
  status: BatchStatus;
  confirmedAction?: ActionType;
  confirmedAt?: string;
  clusterId?: string;
  pendingSync?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedBatch extends Batch {
  digitalTwin: DigitalTwinProfile;
  recommendation: BatchRecommendation;
}

export interface Cluster {
  id: string;
  crop: string;
  locality: string;
  fpoId: string;
  batchIds: string[];
  farmerNames: string[];
  totalQuantityKg: number;
  avgQualityScore: number;
  individualTransportCostPerKg: number;
  pooledTransportCostPerKg: number;
  totalTransportSavingsInr: number;
  storageFacilityName: string;
  storageSlotTotalKg: number;
  storageSlotAllocatedKg: number;
  harvestWindowHours: number;
  status: 'candidate' | 'confirmed' | 'dispatched';
  buyerInterests: Array<{ buyerId: string; buyerName: string; requestedAt: string; note: string }>;
  confirmedAt?: string;
}

export interface Outcome {
  id: string;
  batchId: string;
  crop: string;
  quantityKg: number;
  predictedAction: ActionType;
  predictedValueInr: number;
  actualActionTaken: ActionType;
  actualValueRealisedInr: number;
  actualSpoilagePct: number;
  recordedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'spoilage_alert' | 'cluster_confirmed' | 'price_alert' | 'sms_fallback' | 'system';
  titleEn: string;
  titleHi: string;
  messageEn: string;
  messageHi: string;
  batchId?: string;
  clusterId?: string;
  smsDelivered?: boolean;
  smsPhone?: string;
  read: boolean;
  createdAt: string;
}

export interface SavedScenario {
  id: string;
  userId: string;
  batchId: string;
  name: string;
  transportDelayHours: number;
  storageDays: number;
  storageMode: 'ambient' | 'cold';
  priceTrendDeltaPct: number;
  clusterPoolSize: number;
  recommendedAction: ActionType;
  expectedValueInr: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  language: Language;
  mode: 'gemini_rag' | 'offline_template';
  uncertain?: boolean;
  escalateHelpdesk?: boolean;
  createdAt: string;
}

export interface SystemSettings {
  priceAlertThresholdPct: number;
  spoilageAlertThresholdPct: number;
  clusterHarvestWindowHours: number;
  lastMarketSyncAt: string;
}
