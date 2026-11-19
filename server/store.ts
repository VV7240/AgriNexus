import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
} from '../src/types';
import { buildDynamicClusters, enrichBatch } from '../src/utils/prediction';

export interface StoredUser extends User {
  passwordHash?: string;
}

interface OtpRecord {
  phone: string;
  code: string;
  expiresAtMs: number;
  used: boolean;
}

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

export interface DatabaseState {
  users: StoredUser[];
  cropConstants: CropConstant[];
  marketPrices: MarketPrice[];
  batches: Batch[];
  clusters: Cluster[];
  outcomes: Outcome[];
  notifications: NotificationItem[];
  savedScenarios: SavedScenario[];
  chatHistories: Record<string, ChatMessage[]>;
  settings: SystemSettings;
  otps: OtpRecord[];
  sessions: SessionRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'agrinexus-db.json');

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function createInitialSeedState(): DatabaseState {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

  const defaultPassHash = hashPassword('AgriNexus@2026');

  const users: StoredUser[] = [
    {
      id: 'u-farmer-1',
      name: 'Ramesh Patil',
      phone: '9822011223',
      email: 'ramesh.patil@sahyadrifpo.in',
      role: 'farmer',
      fpoId: 'fpo-sahyadri',
      fpoName: 'Sahyadri Horticulture FPO',
      locality: 'Nashik',
      languagePreference: 'en',
      approved: true,
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: defaultPassHash,
      createdAt: hoursAgo(720),
    },
    {
      id: 'u-farmer-2',
      name: 'Sunita Deshmukh',
      phone: '9822044556',
      email: 'sunita.d@sahyadrifpo.in',
      role: 'farmer',
      fpoId: 'fpo-sahyadri',
      fpoName: 'Sahyadri Horticulture FPO',
      locality: 'Nashik',
      languagePreference: 'hi',
      approved: true,
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: defaultPassHash,
      createdAt: hoursAgo(650),
    },
    {
      id: 'u-farmer-3',
      name: 'Harpreet Singh',
      phone: '9814077889',
      email: 'harpreet.s@sahyadrifpo.in',
      role: 'farmer',
      fpoId: 'fpo-sahyadri',
      fpoName: 'Sahyadri Horticulture FPO',
      locality: 'Pune',
      languagePreference: 'en',
      approved: false, // pending FPO approval demonstration
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: defaultPassHash,
      createdAt: hoursAgo(24),
    },
    {
      id: 'u-fpo-1',
      name: 'Vikram Kulkarni',
      phone: '9822099001',
      email: 'admin@sahyadrifpo.in',
      role: 'fpo_admin',
      fpoId: 'fpo-sahyadri',
      fpoName: 'Sahyadri Horticulture FPO',
      locality: 'Nashik',
      languagePreference: 'en',
      approved: true,
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: defaultPassHash,
      createdAt: hoursAgo(1200),
    },
    {
      id: 'u-buyer-1',
      name: 'Ananya Verma (FreshBasket Agro)',
      phone: '9820055443',
      email: 'procurement@freshbasket.in',
      role: 'buyer',
      fpoId: 'fpo-sahyadri',
      fpoName: 'Sahyadri Horticulture FPO',
      locality: 'Mumbai',
      languagePreference: 'en',
      approved: true,
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: defaultPassHash,
      createdAt: hoursAgo(900),
    },
    {
      id: 'u-sysadmin-1',
      name: 'Dr. Kavita Rao',
      phone: '9811022334',
      email: 'sysadmin@agrinexus.gov.in',
      role: 'system_admin',
      fpoId: 'platform',
      fpoName: 'AgriNexus Central Ops',
      locality: 'Bengaluru',
      languagePreference: 'en',
      approved: true,
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: defaultPassHash,
      createdAt: hoursAgo(1500),
    },
  ];

  const cropConstants: CropConstant[] = [
    {
      crop: 'Tomato',
      cropHi: 'टमाटर',
      baseShelfLifeHours: 108,
      defaultInitialQuality: 96,
      defaultAmbientTempC: 28,
      coldStorageTempC: 10,
      processingRatePerKg: 19,
      processingCostPerKg: 2.4,
      storageCostPerKgPerDay: 1.1,
      individualTransportRatePerKg: 3.6,
      pooledTransportRatePerKg: 2.1,
      redirectExtraCostPerKg: 0.9,
    },
    {
      crop: 'Onion',
      cropHi: 'प्याज',
      baseShelfLifeHours: 480,
      defaultInitialQuality: 97,
      defaultAmbientTempC: 27,
      coldStorageTempC: 4,
      processingRatePerKg: 21,
      processingCostPerKg: 2.2,
      storageCostPerKgPerDay: 0.65,
      individualTransportRatePerKg: 2.8,
      pooledTransportRatePerKg: 1.7,
      redirectExtraCostPerKg: 0.7,
    },
    {
      crop: 'Potato',
      cropHi: 'आलू',
      baseShelfLifeHours: 600,
      defaultInitialQuality: 98,
      defaultAmbientTempC: 24,
      coldStorageTempC: 4,
      processingRatePerKg: 18,
      processingCostPerKg: 2.0,
      storageCostPerKgPerDay: 0.55,
      individualTransportRatePerKg: 2.5,
      pooledTransportRatePerKg: 1.5,
      redirectExtraCostPerKg: 0.6,
    },
    {
      crop: 'Mango',
      cropHi: 'आम',
      baseShelfLifeHours: 144,
      defaultInitialQuality: 95,
      defaultAmbientTempC: 30,
      coldStorageTempC: 12,
      processingRatePerKg: 48,
      processingCostPerKg: 4.5,
      storageCostPerKgPerDay: 1.8,
      individualTransportRatePerKg: 4.8,
      pooledTransportRatePerKg: 2.9,
      redirectExtraCostPerKg: 1.2,
    },
    {
      crop: 'Banana',
      cropHi: 'केला',
      baseShelfLifeHours: 120,
      defaultInitialQuality: 95,
      defaultAmbientTempC: 29,
      coldStorageTempC: 13,
      processingRatePerKg: 22,
      processingCostPerKg: 2.5,
      storageCostPerKgPerDay: 1.2,
      individualTransportRatePerKg: 3.4,
      pooledTransportRatePerKg: 2.0,
      redirectExtraCostPerKg: 0.85,
    },
    {
      crop: 'Okra',
      cropHi: 'भिंडी',
      baseShelfLifeHours: 72,
      defaultInitialQuality: 94,
      defaultAmbientTempC: 29,
      coldStorageTempC: 8,
      processingRatePerKg: 24,
      processingCostPerKg: 2.8,
      storageCostPerKgPerDay: 1.4,
      individualTransportRatePerKg: 3.8,
      pooledTransportRatePerKg: 2.3,
      redirectExtraCostPerKg: 0.9,
    },
    {
      crop: 'Cauliflower',
      cropHi: 'फूलगोभी',
      baseShelfLifeHours: 132,
      defaultInitialQuality: 95,
      defaultAmbientTempC: 25,
      coldStorageTempC: 2,
      processingRatePerKg: 20,
      processingCostPerKg: 2.3,
      storageCostPerKgPerDay: 1.1,
      individualTransportRatePerKg: 3.5,
      pooledTransportRatePerKg: 2.1,
      redirectExtraCostPerKg: 0.8,
    },
  ];

  const marketPrices: MarketPrice[] = [
    {
      id: 'mp-1',
      crop: 'Tomato',
      mandi: 'Pimpalgaon APMC',
      locality: 'Nashik',
      pricePerKg: 24,
      previousPricePerKg: 22,
      trend: 'rising',
      changePct: 9.1,
      arrivalsTonnes: 145,
      source: 'Agmarknet',
      fetchedAt: hoursAgo(2),
    },
    {
      id: 'mp-2',
      crop: 'Tomato',
      mandi: 'Vashi APMC',
      locality: 'Mumbai',
      pricePerKg: 34,
      previousPricePerKg: 31,
      trend: 'rising',
      changePct: 9.7,
      arrivalsTonnes: 220,
      source: 'eNAM',
      fetchedAt: hoursAgo(2),
    },
    {
      id: 'mp-3',
      crop: 'Onion',
      mandi: 'Lasalgaon APMC',
      locality: 'Nashik',
      pricePerKg: 29,
      previousPricePerKg: 26,
      trend: 'rising',
      changePct: 11.5,
      arrivalsTonnes: 410,
      source: 'Agmarknet',
      fetchedAt: hoursAgo(2),
    },
    {
      id: 'mp-4',
      crop: 'Onion',
      mandi: 'Azadpur Mandi',
      locality: 'Delhi',
      pricePerKg: 36,
      previousPricePerKg: 35,
      trend: 'flat',
      changePct: 2.8,
      arrivalsTonnes: 640,
      source: 'eNAM',
      fetchedAt: hoursAgo(2),
    },
    {
      id: 'mp-5',
      crop: 'Potato',
      mandi: 'Pune Gultekdi APMC',
      locality: 'Pune',
      pricePerKg: 21,
      previousPricePerKg: 22,
      trend: 'falling',
      changePct: -4.5,
      arrivalsTonnes: 310,
      source: 'Agmarknet',
      fetchedAt: hoursAgo(3),
    },
    {
      id: 'mp-6',
      crop: 'Mango',
      mandi: 'Vashi Fruit Market',
      locality: 'Mumbai',
      pricePerKg: 78,
      previousPricePerKg: 74,
      trend: 'rising',
      changePct: 5.4,
      arrivalsTonnes: 95,
      source: 'eNAM',
      fetchedAt: hoursAgo(2),
    },
    {
      id: 'mp-7',
      crop: 'Okra',
      mandi: 'Nashik APMC',
      locality: 'Nashik',
      pricePerKg: 32,
      previousPricePerKg: 34,
      trend: 'falling',
      changePct: -5.9,
      arrivalsTonnes: 48,
      source: 'Agmarknet',
      fetchedAt: hoursAgo(2),
    },
    {
      id: 'mp-8',
      crop: 'Banana',
      mandi: 'Jalgaon APMC',
      locality: 'Nashik',
      pricePerKg: 24,
      previousPricePerKg: 23,
      trend: 'rising',
      changePct: 4.3,
      arrivalsTonnes: 185,
      source: 'eNAM',
      fetchedAt: hoursAgo(2),
    },
    {
      id: 'mp-9',
      crop: 'Cauliflower',
      mandi: 'Kolar Mandi',
      locality: 'Bengaluru',
      pricePerKg: 27,
      previousPricePerKg: 26,
      trend: 'flat',
      changePct: 3.8,
      arrivalsTonnes: 112,
      source: 'Agmarknet',
      fetchedAt: hoursAgo(3),
    },
  ];

  const batches: Batch[] = [
    {
      id: 'B-2601',
      farmerId: 'u-farmer-1',
      farmerName: 'Ramesh Patil',
      fpoId: 'fpo-sahyadri',
      crop: 'Tomato',
      quantityKg: 1400,
      harvestTime: hoursAgo(8),
      locality: 'Nashik',
      ambientTempC: 27,
      initialQuality: 96,
      storageMode: 'ambient',
      notes: 'Grade-A Vaishali tomatoes harvested early morning.',
      status: 'active',
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(8),
    },
    {
      id: 'B-2602',
      farmerId: 'u-farmer-1',
      farmerName: 'Ramesh Patil',
      fpoId: 'fpo-sahyadri',
      crop: 'Okra',
      quantityKg: 650,
      harvestTime: hoursAgo(27),
      locality: 'Nashik',
      ambientTempC: 31, // ~2.14x factor -> 72/2.14 = 33.6h shelf life -> ~80% spoilage risk (>70% alert)
      initialQuality: 92,
      storageMode: 'ambient',
      notes: 'Held in farm shed awaiting transport.',
      status: 'active',
      createdAt: hoursAgo(27),
      updatedAt: hoursAgo(12),
    },
    {
      id: 'B-2603',
      farmerId: 'u-farmer-1',
      farmerName: 'Ramesh Patil',
      fpoId: 'fpo-sahyadri',
      crop: 'Onion',
      quantityKg: 2400,
      harvestTime: hoursAgo(36),
      locality: 'Nashik',
      ambientTempC: 26,
      initialQuality: 97,
      storageMode: 'ambient',
      notes: 'Cured Bhima Shakti red onion lot.',
      status: 'active',
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(36),
    },
    {
      id: 'B-2604',
      farmerId: 'u-farmer-2',
      farmerName: 'Sunita Deshmukh',
      fpoId: 'fpo-sahyadri',
      crop: 'Tomato',
      quantityKg: 1100,
      harvestTime: hoursAgo(6),
      locality: 'Nashik',
      ambientTempC: 26,
      initialQuality: 97,
      storageMode: 'ambient',
      notes: 'Sorted and crated for FPO dispatch.',
      status: 'active',
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
    },
    {
      id: 'B-2605',
      farmerId: 'u-farmer-2',
      farmerName: 'Sunita Deshmukh',
      fpoId: 'fpo-sahyadri',
      crop: 'Onion',
      quantityKg: 1850,
      harvestTime: hoursAgo(28),
      locality: 'Nashik',
      ambientTempC: 25,
      initialQuality: 96,
      storageMode: 'cold',
      notes: 'Stored in ventilated FPO shed.',
      status: 'active',
      createdAt: hoursAgo(28),
      updatedAt: hoursAgo(28),
    },
  ];

  const outcomes: Outcome[] = [
    {
      id: 'OUT-901',
      batchId: 'B-2588',
      crop: 'Tomato',
      quantityKg: 1200,
      predictedAction: 'redirect',
      predictedValueInr: 34200,
      actualActionTaken: 'redirect',
      actualValueRealisedInr: 33600,
      actualSpoilagePct: 4.5,
      recordedAt: hoursAgo(120),
    },
    {
      id: 'OUT-902',
      batchId: 'B-2590',
      crop: 'Onion',
      quantityKg: 2000,
      predictedAction: 'store',
      predictedValueInr: 58400,
      actualActionTaken: 'store',
      actualValueRealisedInr: 60100,
      actualSpoilagePct: 2.1,
      recordedAt: hoursAgo(96),
    },
    {
      id: 'OUT-903',
      batchId: 'B-2594',
      crop: 'Okra',
      quantityKg: 500,
      predictedAction: 'process',
      predictedValueInr: 9800,
      actualActionTaken: 'sell',
      actualValueRealisedInr: 7900,
      actualSpoilagePct: 18.0,
      recordedAt: hoursAgo(72),
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      userId: 'u-farmer-1',
      type: 'spoilage_alert',
      titleEn: 'High Spoilage Risk: Batch B-2602 (Okra)',
      titleHi: 'उच्च खराबी जोखिम: बैच B-2602 (भिंडी)',
      messageEn: 'Okra batch B-2602 (650 kg) has crossed 70% spoilage risk at 31°C. Immediate sale or processing recommended.',
      messageHi: 'भिंडी बैच B-2602 (650 किग्रा) 31°C पर 70% खराबी जोखिम पार कर चुका है। तुरंत बिक्री या प्रसंस्करण करें।',
      batchId: 'B-2602',
      smsDelivered: true,
      smsPhone: '9822011223',
      read: false,
      createdAt: hoursAgo(1),
    },
    {
      id: 'notif-2',
      userId: 'u-farmer-1',
      type: 'price_alert',
      titleEn: 'Mandi Price Surge: Onion (+11.5%)',
      titleHi: 'मंडी भाव उछाल: प्याज (+11.5%)',
      messageEn: 'Lasalgaon APMC Onion price rose to ₹29/kg (+11.5% vs yesterday).',
      messageHi: 'लासलगांव मंडी में प्याज का भाव ₹29/किग्रा (+11.5%) तक बढ़ गया है।',
      read: false,
      createdAt: hoursAgo(2),
    },
    {
      id: 'notif-3',
      userId: 'u-farmer-2',
      type: 'sms_fallback',
      titleEn: 'SMS Fallback Sent: Tomato Cluster Opportunity',
      titleHi: 'एसएमएस अलर्ट भेजा गया: टमाटर क्लस्टर अवसर',
      messageEn: 'SMS dispatched to +91-9822044556: 2,500 kg Nashik Tomato cluster ready for pooled dispatch to Vashi APMC.',
      messageHi: '+91-9822044556 पर एसएमएस भेजा गया: वाशी मंडी के लिए 2,500 किग्रा नासिक टमाटर क्लस्टर तैयार।',
      read: false,
      createdAt: hoursAgo(3),
    },
  ];

  const settings: SystemSettings = {
    priceAlertThresholdPct: 5,
    spoilageAlertThresholdPct: 70,
    clusterHarvestWindowHours: 48,
    lastMarketSyncAt: hoursAgo(2),
  };

  const enriched = batches.map((b) =>
    enrichBatch(b, cropConstants, marketPrices, now, settings.spoilageAlertThresholdPct)
  );
  const clusters = buildDynamicClusters(enriched, cropConstants, [], settings.clusterHarvestWindowHours);

  // Confirm the Onion cluster initially so Buyers immediately see a confirmed pooled cluster
  const onionCluster = clusters.find((c) => c.crop === 'Onion');
  if (onionCluster) {
    onionCluster.status = 'confirmed';
    onionCluster.confirmedAt = hoursAgo(5);
  }

  return {
    users,
    cropConstants,
    marketPrices,
    batches,
    clusters,
    outcomes,
    notifications,
    savedScenarios: [],
    chatHistories: {},
    settings,
    otps: [],
    sessions: [],
  };
}

class AgriNexusStore {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.batches)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read DB file, recreating seed state:', err);
    }
    const seed = createInitialSeedState();
    this.saveState(seed);
    return seed;
  }

  private saveState(next: DatabaseState): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(next, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public commit(): void {
    this.saveState(this.state);
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public sanitizeUser(u: StoredUser): User {
    const { passwordHash: _ph, ...safe } = u;
    return safe;
  }

  public getEnrichedBatches(filterFarmerId?: string): EnrichedBatch[] {
    const now = Date.now();
    const list = filterFarmerId
      ? this.state.batches.filter((b) => b.farmerId === filterFarmerId)
      : this.state.batches;
    return list
      .filter((b) => b.status !== 'archived')
      .map((b) =>
        enrichBatch(
          b,
          this.state.cropConstants,
          this.state.marketPrices,
          now,
          this.state.settings.spoilageAlertThresholdPct
        )
      )
      .sort((a, b) => b.digitalTwin.spoilageRisk - a.digitalTwin.spoilageRisk);
  }

  public refreshClusters(): Cluster[] {
    const enriched = this.getEnrichedBatches();
    this.state.clusters = buildDynamicClusters(
      enriched,
      this.state.cropConstants,
      this.state.clusters,
      this.state.settings.clusterHarvestWindowHours
    );
    this.commit();
    return this.state.clusters;
  }

  public createSession(userId: string): string {
    const token = crypto.randomBytes(24).toString('hex');
    this.state.sessions.push({
      token,
      userId,
      createdAt: new Date().toISOString(),
    });
    if (this.state.sessions.length > 200) {
      this.state.sessions = this.state.sessions.slice(-150);
    }
    this.commit();
    return token;
  }

  public getUserByToken(token?: string): StoredUser | undefined {
    if (!token) return undefined;
    const session = this.state.sessions.find((s) => s.token === token);
    if (!session) return undefined;
    return this.state.users.find((u) => u.id === session.userId);
  }

  public createOtp(phone: string): string {
    // Deterministic 6-digit OTP stored for 5 min (NFR-2.4)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.state.otps = this.state.otps.filter((o) => o.phone !== phone);
    this.state.otps.push({
      phone,
      code,
      expiresAtMs: Date.now() + 5 * 60 * 1000,
      used: false,
    });
    this.commit();
    return code;
  }

  public verifyOtp(phone: string, code: string): { ok: boolean; reason?: string } {
    const rec = this.state.otps.find((o) => o.phone === phone && o.code === code);
    if (!rec) return { ok: false, reason: 'Invalid OTP code.' };
    if (rec.used) return { ok: false, reason: 'OTP has already been used.' };
    if (Date.now() > rec.expiresAtMs) return { ok: false, reason: 'OTP has expired (5 min limit).' };
    rec.used = true;
    this.commit();
    return { ok: true };
  }

  public pushNotification(notif: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): NotificationItem {
    const item: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(item);
    if (this.state.notifications.length > 100) {
      this.state.notifications = this.state.notifications.slice(0, 100);
    }
    this.commit();
    return item;
  }
}

export const store = new AgriNexusStore();
