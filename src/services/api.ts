import {
  ActionType,
  Batch,
  ChatMessage,
  Cluster,
  CropConstant,
  EnrichedBatch,
  Language,
  MarketPrice,
  NotificationItem,
  Outcome,
  SavedScenario,
  SystemSettings,
  User,
  UserRole,
} from '../types';
import { enrichBatch } from '../utils/prediction';

const TOKEN_KEY = 'agrinexus_token';
const USER_KEY = 'agrinexus_user';
const OFFLINE_MODE_KEY = 'agrinexus_offline_mode';
const OFFLINE_QUEUE_KEY = 'agrinexus_offline_batches';
const CACHED_BATCHES_KEY = 'agrinexus_cached_batches';
const CACHED_PRICES_KEY = 'agrinexus_cached_prices';
const CACHED_CROPS_KEY = 'agrinexus_cached_crops';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getOfflineMode(): boolean {
  return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
}

export function setOfflineModeStorage(enabled: boolean): void {
  localStorage.setItem(OFFLINE_MODE_KEY, enabled ? 'true' : 'false');
}

export function getQueuedOfflineBatches(): Batch[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Batch[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineBatch(batch: Batch): Batch[] {
  const list = getQueuedOfflineBatches();
  const next = [batch, ...list];
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
  return next;
}

export function clearQueuedOfflineBatches(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export function cacheOfflineData(params: {
  batches?: EnrichedBatch[];
  prices?: MarketPrice[];
  crops?: CropConstant[];
}): void {
  if (params.batches) {
    localStorage.setItem(CACHED_BATCHES_KEY, JSON.stringify(params.batches));
  }
  if (params.prices) {
    localStorage.setItem(CACHED_PRICES_KEY, JSON.stringify(params.prices));
  }
  if (params.crops) {
    localStorage.setItem(CACHED_CROPS_KEY, JSON.stringify(params.crops));
  }
}

export function getCachedOfflineData(): {
  batches: EnrichedBatch[];
  prices: MarketPrice[];
  crops: CropConstant[];
} {
  try {
    const batches = JSON.parse(localStorage.getItem(CACHED_BATCHES_KEY) || '[]') as EnrichedBatch[];
    const prices = JSON.parse(localStorage.getItem(CACHED_PRICES_KEY) || '[]') as MarketPrice[];
    const crops = JSON.parse(localStorage.getItem(CACHED_CROPS_KEY) || '[]') as CropConstant[];
    const queued = getQueuedOfflineBatches();
    if (queued.length > 0 && crops.length > 0) {
      const enrichedQueued = queued.map((b) => enrichBatch(b, crops, prices));
      return { batches: [...enrichedQueued, ...batches], prices, crops };
    }
    return { batches, prices, crops };
  } catch {
    return { batches: [], prices: [], crops: [] };
  }
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  requestOtp: (phone: string) =>
    apiRequest<{ ok: boolean; expiresInSeconds: number; message: string; devPreviewCode: string }>(
      '/api/auth/request-otp',
      { method: 'POST', body: JSON.stringify({ phone }) }
    ),

  verifyOtp: (phone: string, otp: string) =>
    apiRequest<{ token: string; user: User }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),

  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: {
    name: string;
    phone?: string;
    email?: string;
    password?: string;
    otp?: string;
    role: UserRole;
    locality: string;
    languagePreference: Language;
  }) =>
    apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  recoverAccount: (phone: string, otp: string, newPassword?: string) =>
    apiRequest<{ ok: boolean; token: string; user: User }>('/api/auth/recover', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, newPassword }),
    }),

  demoLogin: (role: UserRole) =>
    apiRequest<{ token: string; user: User }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  getMe: () => apiRequest<{ user: User }>('/api/auth/me'),

  updatePreferences: (payload: { languagePreference?: Language; locality?: string; name?: string }) =>
    apiRequest<{ user: User }>('/api/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getCrops: () =>
    apiRequest<{ cropConstants: CropConstant[]; settings: SystemSettings }>('/api/meta/crops'),

  getBatches: () => apiRequest<{ batches: EnrichedBatch[] }>('/api/batches'),

  createBatch: (payload: Partial<Batch>) =>
    apiRequest<{ batch: EnrichedBatch }>('/api/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  syncOfflineBatches: (queuedBatches: Batch[]) =>
    apiRequest<{ syncedCount: number; syncedIds: string[]; batches: EnrichedBatch[] }>(
      '/api/batches/sync',
      { method: 'POST', body: JSON.stringify({ queuedBatches }) }
    ),

  updateBatch: (id: string, payload: Partial<Batch>) =>
    apiRequest<{ batch: EnrichedBatch }>(`/api/batches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  confirmBatchAction: (id: string, action: ActionType) =>
    apiRequest<{ batch: EnrichedBatch }>(`/api/batches/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  logBatchOutcome: (
    id: string,
    payload: {
      actualActionTaken: ActionType;
      actualValueRealisedInr: number;
      actualSpoilagePct: number;
    }
  ) =>
    apiRequest<{ outcome: Outcome; batchId: string }>(`/api/batches/${id}/outcome`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMarketPrices: () =>
    apiRequest<{
      marketPrices: MarketPrice[];
      lastSyncedAt: string;
      priceAlertThresholdPct: number;
    }>('/api/market-prices'),

  refreshMarketPrices: () =>
    apiRequest<{ marketPrices: MarketPrice[]; lastSyncedAt: string }>(
      '/api/market-prices/refresh',
      { method: 'POST' }
    ),

  overrideMarketPrice: (id: string, pricePerKg: number) =>
    apiRequest<{ marketPrice: MarketPrice }>(`/api/market-prices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pricePerKg }),
    }),

  getClusters: () => apiRequest<{ clusters: Cluster[] }>('/api/clusters'),

  confirmCluster: (id: string) =>
    apiRequest<{ cluster: Cluster }>(`/api/clusters/${id}/confirm`, {
      method: 'POST',
    }),

  expressBuyerInterest: (id: string, note: string) =>
    apiRequest<{ cluster: Cluster }>(`/api/clusters/${id}/interest`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  getScenarios: () => apiRequest<{ scenarios: SavedScenario[] }>('/api/scenarios'),

  saveScenario: (payload: Omit<SavedScenario, 'id' | 'userId' | 'createdAt'>) =>
    apiRequest<{ scenario: SavedScenario }>('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getNotifications: () =>
    apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),

  markNotificationsRead: () =>
    apiRequest<{ ok: boolean }>('/api/notifications/mark-read', { method: 'POST' }),

  getReportsSummary: () =>
    apiRequest<{
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
    }>('/api/reports/summary'),

  getAssistHistory: () => apiRequest<{ messages: ChatMessage[] }>('/api/assist/history'),

  askAssist: (payload: { message: string; batchId?: string; language: Language }) =>
    apiRequest<{ message: ChatMessage }>('/api/assist/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  escalateHelpdesk: (payload: { question: string; batchId?: string }) =>
    apiRequest<{ ok: boolean; ticketId: string }>('/api/assist/helpdesk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAdminOverview: () =>
    apiRequest<{
      users: User[];
      cropConstants: CropConstant[];
      settings: SystemSettings;
      health: {
        uptimeSeconds: number;
        totalBatches: number;
        totalOutcomesLogged: number;
        activeSessions: number;
        geminiConfigured: boolean;
        lastMarketSyncAt: string;
      };
    }>('/api/admin/overview'),

  updateAdminUser: (id: string, payload: { approved?: boolean; role?: UserRole; unlock?: boolean }) =>
    apiRequest<{ user: User }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateCropConstant: (crop: string, payload: Partial<CropConstant>) =>
    apiRequest<{ cropConstant: CropConstant }>(`/api/admin/crops/${encodeURIComponent(crop)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateSettings: (payload: Partial<SystemSettings>) =>
    apiRequest<{ settings: SystemSettings }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
