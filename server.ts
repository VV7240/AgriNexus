import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAgriNexusAssistReply } from './server/gemini';
import { hashPassword, store, StoredUser, verifyPassword } from './server/store';
import {
  ActionType,
  Batch,
  ChatMessage,
  Language,
  UserRole,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AuthedRequest extends Request {
  user?: StoredUser;
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const user = store.getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.user = user;
  next();
}

function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied for role '${req.user.role}'. Required: ${roles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}

function checkLockout(user: StoredUser): string | null {
  if (user.lockedUntil) {
    const until = new Date(user.lockedUntil).getTime();
    if (Date.now() < until) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      return `Account locked for ${mins} more minute(s) due to 5 consecutive failed attempts.`;
    }
    user.lockedUntil = null;
    user.failedAttempts = 0;
    store.commit();
  }
  return null;
}

function recordFailedAttempt(user: StoredUser): string | null {
  user.failedAttempts = (user.failedAttempts ?? 0) + 1;
  if (user.failedAttempts >= 5) {
    user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    store.commit();
    return 'Account locked for 15 minutes after 5 consecutive failed login attempts.';
  }
  store.commit();
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // =========================================================================
  // AUTHENTICATION & ACCOUNT ENDPOINTS (FR-1.1 to FR-1.6, NFR-2.2 to NFR-2.4)
  // =========================================================================

  app.post('/api/auth/request-otp', (req: Request, res: Response) => {
    const { phone } = req.body as { phone?: string };
    const cleanPhone = (phone ?? '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
      return;
    }
    const code = store.createOtp(cleanPhone);
    // In production, dispatched via MSG91/Twilio SMS gateway. Returned as devPreviewCode for hackathon verification.
    res.json({
      ok: true,
      expiresInSeconds: 300,
      message: `OTP dispatched to +91-${cleanPhone} (valid for 5 minutes).`,
      devPreviewCode: code,
    });
  });

  app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
    const { phone, otp } = req.body as { phone?: string; otp?: string };
    const cleanPhone = (phone ?? '').replace(/\D/g, '').slice(-10);
    const state = store.getState();
    const user = state.users.find((u) => u.phone === cleanPhone);

    if (user) {
      const lockMsg = checkLockout(user);
      if (lockMsg) {
        res.status(423).json({ error: lockMsg });
        return;
      }
    }

    const check = store.verifyOtp(cleanPhone, (otp ?? '').trim());
    if (!check.ok) {
      if (user) {
        const lockedMsg = recordFailedAttempt(user);
        if (lockedMsg) {
          res.status(423).json({ error: lockedMsg });
          return;
        }
      }
      res.status(400).json({ error: check.reason ?? 'Invalid OTP.' });
      return;
    }

    if (!user) {
      res.status(404).json({
        error: 'No account found for this mobile number. Please sign up first.',
      });
      return;
    }

    if (!user.approved && user.role === 'farmer') {
      res.status(403).json({
        error: 'Your farmer account is awaiting approval from your FPO Administrator.',
      });
      return;
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    const token = store.createSession(user.id);
    res.json({ token, user: store.sanitizeUser(user) });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const state = store.getState();
    const user = state.users.find(
      (u) => u.email?.toLowerCase() === (email ?? '').trim().toLowerCase()
    );
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const lockMsg = checkLockout(user);
    if (lockMsg) {
      res.status(423).json({ error: lockMsg });
      return;
    }
    if (!verifyPassword(password ?? '', user.passwordHash)) {
      const lockedMsg = recordFailedAttempt(user);
      if (lockedMsg) {
        res.status(423).json({ error: lockedMsg });
        return;
      }
      res.status(401).json({
        error: `Invalid password. ${5 - (user.failedAttempts ?? 0)} attempt(s) remaining before 15-min lockout.`,
      });
      return;
    }
    if (!user.approved && user.role === 'farmer') {
      res.status(403).json({
        error: 'Your farmer account is pending FPO Administrator approval.',
      });
      return;
    }
    user.failedAttempts = 0;
    user.lockedUntil = null;
    const token = store.createSession(user.id);
    res.json({ token, user: store.sanitizeUser(user) });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const {
      name,
      phone,
      email,
      password,
      otp,
      role,
      locality,
      languagePreference,
    } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      password?: string;
      otp?: string;
      role?: UserRole;
      locality?: string;
      languagePreference?: Language;
    };

    if (!name?.trim() || !locality?.trim()) {
      res.status(400).json({ error: 'Name and locality are required.' });
      return;
    }
    const chosenRole: UserRole =
      role === 'fpo_admin' || role === 'buyer' ? role : 'farmer';

    const state = store.getState();
    const cleanPhone = (phone ?? '').replace(/\D/g, '').slice(-10);

    if (chosenRole === 'farmer') {
      if (cleanPhone.length < 10) {
        res.status(400).json({ error: 'Valid 10-digit mobile number is required for farmers.' });
        return;
      }
      if (otp) {
        const otpCheck = store.verifyOtp(cleanPhone, otp.trim());
        if (!otpCheck.ok) {
          res.status(400).json({ error: otpCheck.reason ?? 'Invalid OTP.' });
          return;
        }
      }
      if (state.users.some((u) => u.phone === cleanPhone)) {
        res.status(409).json({ error: 'An account with this phone number already exists.' });
        return;
      }
    } else {
      if (!email?.trim() || !password || password.length < 6) {
        res.status(400).json({ error: 'Valid email and password (min 6 chars) are required.' });
        return;
      }
      if (state.users.some((u) => u.email?.toLowerCase() === email.trim().toLowerCase())) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }
    }

    const newUser: StoredUser = {
      id: `u-${Date.now()}`,
      name: name.trim(),
      phone: cleanPhone || undefined,
      email: email?.trim() || undefined,
      role: chosenRole,
      fpoId: 'fpo-sahyadri',
      fpoName: 'Sahyadri Horticulture FPO',
      locality: locality.trim(),
      languagePreference: languagePreference ?? 'en',
      approved: true,
      failedAttempts: 0,
      lockedUntil: null,
      passwordHash: password ? hashPassword(password) : undefined,
      createdAt: new Date().toISOString(),
    };

    state.users.push(newUser);
    const token = store.createSession(newUser.id);
    res.status(201).json({ token, user: store.sanitizeUser(newUser) });
  });

  app.post('/api/auth/recover', (req: Request, res: Response) => {
    const { phone, otp, newPassword } = req.body as {
      phone?: string;
      otp?: string;
      newPassword?: string;
    };
    const cleanPhone = (phone ?? '').replace(/\D/g, '').slice(-10);
    const user = store.getState().users.find((u) => u.phone === cleanPhone);
    if (!user) {
      res.status(404).json({ error: 'Account not found for that mobile number.' });
      return;
    }
    const check = store.verifyOtp(cleanPhone, (otp ?? '').trim());
    if (!check.ok) {
      res.status(400).json({ error: check.reason ?? 'Invalid OTP.' });
      return;
    }
    if (newPassword && newPassword.length >= 6) {
      user.passwordHash = hashPassword(newPassword);
    }
    user.failedAttempts = 0;
    user.lockedUntil = null;
    const token = store.createSession(user.id);
    res.json({ ok: true, token, user: store.sanitizeUser(user) });
  });

  app.post('/api/auth/demo-login', (req: Request, res: Response) => {
    const { role } = req.body as { role?: UserRole };
    const targetRole: UserRole = role ?? 'farmer';
    const user = store
      .getState()
      .users.find((u) => u.role === targetRole && u.approved);
    if (!user) {
      res.status(404).json({ error: 'Demo account not found.' });
      return;
    }
    user.failedAttempts = 0;
    user.lockedUntil = null;
    const token = store.createSession(user.id);
    res.json({ token, user: store.sanitizeUser(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: store.sanitizeUser(req.user!) });
  });

  app.patch('/api/auth/preferences', requireAuth, (req: AuthedRequest, res: Response) => {
    const { languagePreference, locality, name } = req.body as {
      languagePreference?: Language;
      locality?: string;
      name?: string;
    };
    if (languagePreference) req.user!.languagePreference = languagePreference;
    if (locality?.trim()) req.user!.locality = locality.trim();
    if (name?.trim()) req.user!.name = name.trim();
    store.commit();
    res.json({ user: store.sanitizeUser(req.user!) });
  });

  // =========================================================================
  // BOOTSTRAP DATA / CROP CONSTANTS
  // =========================================================================

  app.get('/api/meta/crops', requireAuth, (_req: AuthedRequest, res: Response) => {
    const state = store.getState();
    res.json({
      cropConstants: state.cropConstants,
      settings: state.settings,
    });
  });

  // =========================================================================
  // BATCHES, DIGITAL TWIN & DECISION ENGINE (FR-3.x, FR-4.x, FR-7.x)
  // =========================================================================

  app.get('/api/batches', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const farmerFilter = user.role === 'farmer' ? user.id : undefined;
    const batches = store.getEnrichedBatches(farmerFilter);
    res.json({ batches });
  });

  app.post(
    '/api/batches',
    requireAuth,
    requireRoles('farmer', 'fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const user = req.user!;
      const {
        id,
        crop,
        quantityKg,
        harvestTime,
        locality,
        ambientTempC,
        initialQuality,
        storageMode,
        photoDataUrl,
        notes,
      } = req.body as Partial<Batch>;

      if (!crop || !quantityKg || Number(quantityKg) <= 0 || !locality?.trim()) {
        res.status(400).json({
          error: 'Crop type, positive quantity (kg), and locality are required.',
        });
        return;
      }

      const state = store.getState();
      const cropConst =
        state.cropConstants.find((c) => c.crop.toLowerCase() === crop.toLowerCase()) ??
        state.cropConstants[0];

      const nowIso = new Date().toISOString();
      const newBatch: Batch = {
        id: id ?? `B-${Math.floor(2600 + Math.random() * 7000)}`,
        farmerId: user.id,
        farmerName: user.name,
        fpoId: user.fpoId,
        crop: cropConst.crop,
        quantityKg: Number(quantityKg),
        harvestTime: harvestTime || nowIso,
        locality: locality.trim(),
        ambientTempC:
          ambientTempC !== undefined ? Number(ambientTempC) : cropConst.defaultAmbientTempC,
        initialQuality:
          initialQuality !== undefined
            ? Number(initialQuality)
            : cropConst.defaultInitialQuality,
        storageMode: storageMode === 'cold' ? 'cold' : 'ambient',
        photoDataUrl,
        notes: notes?.trim(),
        status: 'active',
        pendingSync: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      state.batches.unshift(newBatch);
      store.refreshClusters();

      const enriched = store
        .getEnrichedBatches()
        .find((b) => b.id === newBatch.id);

      if (
        enriched &&
        enriched.digitalTwin.spoilageRisk >= state.settings.spoilageAlertThresholdPct
      ) {
        store.pushNotification({
          userId: user.id,
          type: 'spoilage_alert',
          titleEn: `High Spoilage Risk: Batch ${enriched.id} (${enriched.crop})`,
          titleHi: `उच्च खराबी जोखिम: बैच ${enriched.id} (${cropConst.cropHi})`,
          messageEn: `Batch ${enriched.id} (${enriched.quantityKg} kg) already has ${enriched.digitalTwin.spoilageRisk}% spoilage risk. Recommended: ${enriched.recommendation.recommendedAction.toUpperCase()}.`,
          messageHi: `बैच ${enriched.id} (${enriched.quantityKg} किग्रा) में ${enriched.digitalTwin.spoilageRisk}% खराबी जोखिम है।`,
          batchId: enriched.id,
          smsDelivered: Boolean(user.phone),
          smsPhone: user.phone,
        });
      }

      res.status(201).json({ batch: enriched });
    }
  );

  app.post(
    '/api/batches/sync',
    requireAuth,
    requireRoles('farmer', 'fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const user = req.user!;
      const { queuedBatches } = req.body as { queuedBatches?: Array<Partial<Batch>> };
      if (!Array.isArray(queuedBatches)) {
        res.status(400).json({ error: 'queuedBatches array required.' });
        return;
      }

      const state = store.getState();
      const syncedIds: string[] = [];

      for (const item of queuedBatches) {
        if (!item.crop || !item.quantityKg || !item.locality) continue;
        if (item.id && state.batches.some((b) => b.id === item.id)) continue;

        const cropConst =
          state.cropConstants.find(
            (c) => c.crop.toLowerCase() === item.crop!.toLowerCase()
          ) ?? state.cropConstants[0];

        const batch: Batch = {
          id: item.id ?? `B-${Math.floor(2600 + Math.random() * 7000)}`,
          farmerId: user.id,
          farmerName: user.name,
          fpoId: user.fpoId,
          crop: cropConst.crop,
          quantityKg: Number(item.quantityKg),
          harvestTime: item.harvestTime || new Date().toISOString(),
          locality: item.locality,
          ambientTempC: item.ambientTempC ?? cropConst.defaultAmbientTempC,
          initialQuality: item.initialQuality ?? cropConst.defaultInitialQuality,
          storageMode: item.storageMode === 'cold' ? 'cold' : 'ambient',
          photoDataUrl: item.photoDataUrl,
          notes: item.notes,
          status: 'active',
          pendingSync: false,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.batches.unshift(batch);
        syncedIds.push(batch.id);
      }

      store.refreshClusters();
      res.json({
        syncedCount: syncedIds.length,
        syncedIds,
        batches: store.getEnrichedBatches(user.role === 'farmer' ? user.id : undefined),
      });
    }
  );

  app.patch(
    '/api/batches/:id',
    requireAuth,
    requireRoles('farmer', 'fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const state = store.getState();
      const batch = state.batches.find((b) => b.id === req.params.id);
      if (!batch) {
        res.status(404).json({ error: 'Batch not found.' });
        return;
      }
      if (req.user!.role === 'farmer' && batch.farmerId !== req.user!.id) {
        res.status(403).json({ error: 'Cannot modify another farmer batch.' });
        return;
      }

      const { quantityKg, ambientTempC, storageMode, locality, notes, status } =
        req.body as Partial<Batch>;
      if (quantityKg !== undefined && Number(quantityKg) > 0) batch.quantityKg = Number(quantityKg);
      if (ambientTempC !== undefined) batch.ambientTempC = Number(ambientTempC);
      if (storageMode === 'cold' || storageMode === 'ambient') batch.storageMode = storageMode;
      if (locality?.trim()) batch.locality = locality.trim();
      if (notes !== undefined) batch.notes = notes;
      if (status === 'archived' || status === 'active') batch.status = status;
      batch.updatedAt = new Date().toISOString();

      store.refreshClusters();
      const enriched = store.getEnrichedBatches().find((b) => b.id === batch.id);
      res.json({ batch: enriched });
    }
  );

  app.post(
    '/api/batches/:id/confirm',
    requireAuth,
    requireRoles('farmer', 'fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const { action } = req.body as { action?: ActionType };
      const state = store.getState();
      const batch = state.batches.find((b) => b.id === req.params.id);
      if (!batch) {
        res.status(404).json({ error: 'Batch not found.' });
        return;
      }
      if (req.user!.role === 'farmer' && batch.farmerId !== req.user!.id) {
        res.status(403).json({ error: 'Forbidden.' });
        return;
      }

      const currentEnriched = store.getEnrichedBatches().find((b) => b.id === batch.id);
      const chosenAction = action ?? currentEnriched?.recommendation.recommendedAction ?? 'sell';

      batch.status = 'action_confirmed';
      batch.confirmedAction = chosenAction;
      batch.confirmedAt = new Date().toISOString();
      if (chosenAction === 'store') {
        batch.storageMode = 'cold';
      }
      batch.updatedAt = new Date().toISOString();
      store.commit();

      const updated = store.getEnrichedBatches().find((b) => b.id === batch.id);
      res.json({ batch: updated });
    }
  );

  app.post(
    '/api/batches/:id/outcome',
    requireAuth,
    requireRoles('farmer', 'fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const { actualActionTaken, actualValueRealisedInr, actualSpoilagePct } =
        req.body as {
          actualActionTaken?: ActionType;
          actualValueRealisedInr?: number;
          actualSpoilagePct?: number;
        };

      const state = store.getState();
      const batch = state.batches.find((b) => b.id === req.params.id);
      if (!batch) {
        res.status(404).json({ error: 'Batch not found.' });
        return;
      }

      const enriched = store.getEnrichedBatches().find((b) => b.id === batch.id);
      if (!actualActionTaken || actualValueRealisedInr === undefined) {
        res.status(400).json({ error: 'Actual action and realised value (₹) are required.' });
        return;
      }

      const outcome = {
        id: `OUT-${Date.now()}`,
        batchId: batch.id,
        crop: batch.crop,
        quantityKg: batch.quantityKg,
        predictedAction: enriched?.recommendation.recommendedAction ?? 'sell',
        predictedValueInr: enriched?.recommendation.expectedValue ?? 0,
        actualActionTaken,
        actualValueRealisedInr: Number(actualValueRealisedInr),
        actualSpoilagePct: Number(actualSpoilagePct ?? 5),
        recordedAt: new Date().toISOString(),
      };

      state.outcomes.unshift(outcome);
      batch.status = 'completed';
      batch.confirmedAction = actualActionTaken;
      batch.updatedAt = new Date().toISOString();
      store.refreshClusters();

      res.status(201).json({ outcome, batchId: batch.id });
    }
  );

  // =========================================================================
  // MARKET INTELLIGENCE (FR-5.1 to FR-5.4)
  // =========================================================================

  app.get('/api/market-prices', requireAuth, (_req: AuthedRequest, res: Response) => {
    const state = store.getState();
    res.json({
      marketPrices: state.marketPrices,
      lastSyncedAt: state.settings.lastMarketSyncAt,
      priceAlertThresholdPct: state.settings.priceAlertThresholdPct,
    });
  });

  app.post(
    '/api/market-prices/refresh',
    requireAuth,
    requireRoles('fpo_admin', 'system_admin'),
    (_req: AuthedRequest, res: Response) => {
      const state = store.getState();
      const nowIso = new Date().toISOString();
      state.marketPrices = state.marketPrices.map((mp) => {
        // Subtle realistic Agmarknet tick (+/- 2%)
        const delta = (Math.random() - 0.45) * 0.04;
        const nextPrice = Math.max(10, Math.round(mp.pricePerKg * (1 + delta) * 10) / 10);
        const changePct =
          Math.round(((nextPrice - mp.previousPricePerKg) / mp.previousPricePerKg) * 1000) /
          10;
        const trend = changePct > 2 ? 'rising' : changePct < -2 ? 'falling' : 'flat';
        return {
          ...mp,
          pricePerKg: nextPrice,
          changePct,
          trend,
          fetchedAt: nowIso,
        };
      });
      state.settings.lastMarketSyncAt = nowIso;
      store.commit();
      res.json({
        marketPrices: state.marketPrices,
        lastSyncedAt: nowIso,
      });
    }
  );

  app.patch(
    '/api/market-prices/:id',
    requireAuth,
    requireRoles('fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const { pricePerKg } = req.body as { pricePerKg?: number };
      if (!pricePerKg || Number(pricePerKg) <= 0) {
        res.status(400).json({ error: 'Valid positive pricePerKg is required.' });
        return;
      }
      const state = store.getState();
      const mp = state.marketPrices.find((p) => p.id === req.params.id);
      if (!mp) {
        res.status(404).json({ error: 'Market price entry not found.' });
        return;
      }
      mp.previousPricePerKg = mp.pricePerKg;
      mp.pricePerKg = Number(pricePerKg);
      mp.changePct =
        Math.round(((mp.pricePerKg - mp.previousPricePerKg) / mp.previousPricePerKg) * 1000) /
        10;
      mp.trend = mp.changePct > 2 ? 'rising' : mp.changePct < -2 ? 'falling' : 'flat';
      mp.source = 'Admin Override';
      mp.overriddenBy = req.user!.name;
      mp.fetchedAt = new Date().toISOString();

      if (Math.abs(mp.changePct) >= state.settings.priceAlertThresholdPct) {
        store.pushNotification({
          userId: 'all',
          type: 'price_alert',
          titleEn: `Price Threshold Alert: ${mp.crop} (${mp.changePct > 0 ? '+' : ''}${mp.changePct}%)`,
          titleHi: `भाव चेतावनी: ${mp.crop} (${mp.changePct > 0 ? '+' : ''}${mp.changePct}%)`,
          messageEn: `${mp.mandi} updated to ₹${mp.pricePerKg}/kg (${mp.source}).`,
          messageHi: `${mp.mandi} में भाव ₹${mp.pricePerKg}/किग्रा अपडेट हुआ।`,
        });
      } else {
        store.commit();
      }

      res.json({ marketPrice: mp });
    }
  );

  // =========================================================================
  // CLUSTER POOLING (FR-6.1 to FR-6.4)
  // =========================================================================

  app.get('/api/clusters', requireAuth, (req: AuthedRequest, res: Response) => {
    const clusters = store.refreshClusters();
    const user = req.user!;
    // Buyers see confirmed/dispatched clusters plus candidate pooled opportunities in their scope
    if (user.role === 'buyer') {
      res.json({
        clusters: clusters.filter((c) => c.totalQuantityKg >= 500),
      });
      return;
    }
    res.json({ clusters });
  });

  app.post(
    '/api/clusters/:id/confirm',
    requireAuth,
    requireRoles('fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const state = store.getState();
      const cluster = state.clusters.find((c) => c.id === req.params.id);
      if (!cluster) {
        res.status(404).json({ error: 'Cluster not found.' });
        return;
      }
      cluster.status = 'confirmed';
      cluster.confirmedAt = new Date().toISOString();

      // Tag batches & notify member farmers (FR-6.3, FR-11.2, FR-11.3)
      for (const batchId of cluster.batchIds) {
        const b = state.batches.find((x) => x.id === batchId);
        if (b) {
          b.clusterId = cluster.id;
          const farmer = state.users.find((u) => u.id === b.farmerId);
          store.pushNotification({
            userId: b.farmerId,
            type: 'cluster_confirmed',
            titleEn: `Cluster Confirmed: ${cluster.crop} Pool (${cluster.id})`,
            titleHi: `क्लस्टर पुष्ट: ${cluster.crop} पूल (${cluster.id})`,
            messageEn: `Your ${b.quantityKg} kg ${b.crop} batch was added to confirmed pool ${cluster.id}. Transport cost reduced from ₹${cluster.individualTransportCostPerKg}/kg to ₹${cluster.pooledTransportCostPerKg}/kg.`,
            messageHi: `आपका ${b.quantityKg} किग्रा ${b.crop} बैच क्लस्टर ${cluster.id} में जोड़ा गया। परिवहन लागत ₹${cluster.individualTransportCostPerKg}/किग्रा से घटकर ₹${cluster.pooledTransportCostPerKg}/किग्रा हो गई।`,
            batchId: b.id,
            clusterId: cluster.id,
            smsDelivered: Boolean(farmer?.phone),
            smsPhone: farmer?.phone,
          });
        }
      }

      store.commit();
      res.json({ cluster });
    }
  );

  app.post(
    '/api/clusters/:id/interest',
    requireAuth,
    requireRoles('buyer', 'fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const { note } = req.body as { note?: string };
      const state = store.getState();
      const cluster = state.clusters.find((c) => c.id === req.params.id);
      if (!cluster) {
        res.status(404).json({ error: 'Cluster not found.' });
        return;
      }
      cluster.buyerInterests.push({
        buyerId: req.user!.id,
        buyerName: req.user!.name,
        requestedAt: new Date().toISOString(),
        note: note?.trim() || 'Interested in procuring full pooled lot.',
      });
      store.pushNotification({
        userId: 'u-fpo-1',
        type: 'system',
        titleEn: `Buyer Procurement Interest: ${cluster.crop} (${cluster.id})`,
        titleHi: `खरीदार प्रस्ताव: ${cluster.crop} (${cluster.id})`,
        messageEn: `${req.user!.name} requested procurement of ${cluster.totalQuantityKg} kg pooled ${cluster.crop}.`,
        messageHi: `${req.user!.name} ने ${cluster.totalQuantityKg} किग्रा ${cluster.crop} पूल खरीदने का अनुरोध किया है।`,
        clusterId: cluster.id,
      });
      res.json({ cluster });
    }
  );

  // =========================================================================
  // WHAT-IF SAVED SCENARIOS (FR-8.3)
  // =========================================================================

  app.get('/api/scenarios', requireAuth, (req: AuthedRequest, res: Response) => {
    const scenarios = store
      .getState()
      .savedScenarios.filter(
        (s) => req.user!.role !== 'farmer' || s.userId === req.user!.id
      );
    res.json({ scenarios });
  });

  app.post('/api/scenarios', requireAuth, (req: AuthedRequest, res: Response) => {
    const body = req.body as {
      batchId?: string;
      name?: string;
      transportDelayHours?: number;
      storageDays?: number;
      storageMode?: 'ambient' | 'cold';
      priceTrendDeltaPct?: number;
      clusterPoolSize?: number;
      recommendedAction?: ActionType;
      expectedValueInr?: number;
    };
    if (!body.batchId || !body.name?.trim()) {
      res.status(400).json({ error: 'Batch ID and scenario name are required.' });
      return;
    }
    const scenario = {
      id: `SCN-${Date.now()}`,
      userId: req.user!.id,
      batchId: body.batchId,
      name: body.name.trim(),
      transportDelayHours: Number(body.transportDelayHours ?? 0),
      storageDays: Number(body.storageDays ?? 3),
      storageMode: (body.storageMode === 'ambient' ? 'ambient' : 'cold') as 'ambient' | 'cold',
      priceTrendDeltaPct: Number(body.priceTrendDeltaPct ?? 0),
      clusterPoolSize: Number(body.clusterPoolSize ?? 1),
      recommendedAction: body.recommendedAction ?? 'sell',
      expectedValueInr: Number(body.expectedValueInr ?? 0),
      createdAt: new Date().toISOString(),
    };
    store.getState().savedScenarios.unshift(scenario);
    store.commit();
    res.status(201).json({ scenario });
  });

  // =========================================================================
  // NOTIFICATIONS & ALERTS (FR-11.1 to FR-11.3)
  // =========================================================================

  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const items = store.getState().notifications.filter((n) => {
      if (user.role === 'fpo_admin' || user.role === 'system_admin') return true;
      return n.userId === user.id || n.userId === 'all';
    });
    res.json({ notifications: items });
  });

  app.post('/api/notifications/mark-read', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    for (const n of store.getState().notifications) {
      if (
        user.role === 'fpo_admin' ||
        user.role === 'system_admin' ||
        n.userId === user.id ||
        n.userId === 'all'
      ) {
        n.read = true;
      }
    }
    store.commit();
    res.json({ ok: true });
  });

  // =========================================================================
  // REPORTS & ANALYTICS (FR-10.1 to FR-10.3)
  // =========================================================================

  app.get(
    '/api/reports/summary',
    requireAuth,
    requireRoles('fpo_admin', 'system_admin', 'farmer'),
    (_req: AuthedRequest, res: Response) => {
      const state = store.getState();
      const enriched = store.getEnrichedBatches();
      const clusters = store.refreshClusters();

      const totalBatches = enriched.length + state.outcomes.length;
      const totalActiveKg = enriched.reduce((sum, b) => sum + b.quantityKg, 0);
      const totalExpectedValueInr = enriched.reduce(
        (sum, b) => sum + b.recommendation.expectedValue,
        0
      );
      const totalRealisedValueInr = state.outcomes.reduce(
        (sum, o) => sum + o.actualValueRealisedInr,
        0
      );

      // Estimated loss avoided = expected optimal value vs naive immediate distressed sell
      const estimatedLossAvoidedInr = enriched.reduce((sum, b) => {
        const sellOption = b.recommendation.options.find((o) => o.action === 'sell');
        const diff = b.recommendation.expectedValue - (sellOption?.expectedNetValue ?? 0);
        return sum + Math.max(0, diff);
      }, 0);

      const totalTransportSavingsInr = clusters.reduce(
        (sum, c) => sum + c.totalTransportSavingsInr,
        0
      );

      const transportComparison = clusters.map((c) => ({
        clusterId: c.id,
        crop: c.crop,
        locality: c.locality,
        totalKg: c.totalQuantityKg,
        individualCostInr: Math.round(c.totalQuantityKg * c.individualTransportCostPerKg),
        pooledCostInr: Math.round(c.totalQuantityKg * c.pooledTransportCostPerKg),
        savingsInr: Math.round(c.totalTransportSavingsInr),
      }));

      res.json({
        summary: {
          totalBatches,
          activeBatchesCount: enriched.length,
          completedOutcomesCount: state.outcomes.length,
          totalActiveKg,
          totalExpectedValueInr: Math.round(totalExpectedValueInr),
          totalRealisedValueInr: Math.round(totalRealisedValueInr),
          estimatedLossAvoidedInr: Math.round(estimatedLossAvoidedInr),
          totalTransportSavingsInr: Math.round(totalTransportSavingsInr),
        },
        outcomes: state.outcomes,
        transportComparison,
      });
    }
  );

  // =========================================================================
  // AGRINEXUS ASSIST (RAG GEMINI API) (FR-9.1 to FR-9.6)
  // =========================================================================

  app.get('/api/assist/history', requireAuth, (req: AuthedRequest, res: Response) => {
    const history = store.getState().chatHistories[req.user!.id] ?? [];
    res.json({ messages: history });
  });

  app.post('/api/assist/chat', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { message, batchId, language } = req.body as {
      message?: string;
      batchId?: string;
      language?: Language;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const user = req.user!;
    const lang: Language = language ?? user.languagePreference ?? 'en';
    const state = store.getState();
    const allBatches = store.getEnrichedBatches(
      user.role === 'farmer' ? user.id : undefined
    );
    const selectedBatch = batchId
      ? allBatches.find((b) => b.id === batchId)
      : allBatches[0];

    const history = state.chatHistories[user.id] ?? [];

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      text: message.trim(),
      language: lang,
      mode: 'gemini_rag',
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await generateAgriNexusAssistReply({
        question: message.trim(),
        language: lang,
        user: store.sanitizeUser(user),
        selectedBatch,
        allBatches,
        marketPrices: state.marketPrices,
        history: history.map((m) => ({ role: m.role, text: m.text })),
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        text: result.reply,
        language: lang,
        mode: 'gemini_rag',
        uncertain: result.uncertain,
        escalateHelpdesk: result.escalateHelpdesk,
        createdAt: new Date().toISOString(),
      };

      history.push(userMsg, assistantMsg);
      state.chatHistories[user.id] = history.slice(-40);
      store.commit();

      res.json({ message: assistantMsg });
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to reach Gemini AI service.';
      console.error('AgriNexus Assist Gemini error:', errMsg);
      res.status(502).json({
        error: errMsg,
      });
    }
  });

  app.post('/api/assist/helpdesk', requireAuth, (req: AuthedRequest, res: Response) => {
    const { question, batchId } = req.body as { question?: string; batchId?: string };
    store.pushNotification({
      userId: 'u-fpo-1',
      type: 'system',
      titleEn: `FPO Helpdesk Escalation from ${req.user!.name}`,
      titleHi: `${req.user!.name} से FPO हेल्पडेस्क सहायता अनुरोध`,
      messageEn: `Farmer question (${batchId ?? 'General'}): "${question ?? 'Needs agronomy advisor callback'}"`,
      messageHi: `किसान का प्रश्न (${batchId ?? 'सामान्य'}): "${question ?? 'सलाहकार कॉल अनुरोध'}"`,
      batchId,
    });
    res.json({ ok: true, ticketId: `FPO-HLP-${Math.floor(1000 + Math.random() * 9000)}` });
  });

  // =========================================================================
  // SYSTEM ADMIN & FPO MANAGEMENT CONSOLE (FR-12.1 to FR-12.3)
  // =========================================================================

  app.get(
    '/api/admin/overview',
    requireAuth,
    requireRoles('fpo_admin', 'system_admin'),
    (_req: AuthedRequest, res: Response) => {
      const state = store.getState();
      res.json({
        users: state.users.map((u) => store.sanitizeUser(u)),
        cropConstants: state.cropConstants,
        settings: state.settings,
        health: {
          uptimeSeconds: Math.round(process.uptime()),
          totalBatches: state.batches.length,
          totalOutcomesLogged: state.outcomes.length,
          activeSessions: state.sessions.length,
          geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
          lastMarketSyncAt: state.settings.lastMarketSyncAt,
        },
      });
    }
  );

  app.patch(
    '/api/admin/users/:id',
    requireAuth,
    requireRoles('fpo_admin', 'system_admin'),
    (req: AuthedRequest, res: Response) => {
      const { approved, role, unlock } = req.body as {
        approved?: boolean;
        role?: UserRole;
        unlock?: boolean;
      };
      const target = store.getState().users.find((u) => u.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      if (approved !== undefined) target.approved = Boolean(approved);
      if (role && req.user!.role === 'system_admin') target.role = role;
      if (unlock) {
        target.lockedUntil = null;
        target.failedAttempts = 0;
      }
      store.commit();
      res.json({ user: store.sanitizeUser(target) });
    }
  );

  app.patch(
    '/api/admin/crops/:crop',
    requireAuth,
    requireRoles('system_admin', 'fpo_admin'),
    (req: AuthedRequest, res: Response) => {
      const crop = store
        .getState()
        .cropConstants.find((c) => c.crop.toLowerCase() === req.params.crop.toLowerCase());
      if (!crop) {
        res.status(404).json({ error: 'Crop constant not found.' });
        return;
      }
      const {
        baseShelfLifeHours,
        processingRatePerKg,
        storageCostPerKgPerDay,
        individualTransportRatePerKg,
        pooledTransportRatePerKg,
      } = req.body as Partial<typeof crop>;

      if (baseShelfLifeHours !== undefined && Number(baseShelfLifeHours) > 0)
        crop.baseShelfLifeHours = Number(baseShelfLifeHours);
      if (processingRatePerKg !== undefined && Number(processingRatePerKg) > 0)
        crop.processingRatePerKg = Number(processingRatePerKg);
      if (storageCostPerKgPerDay !== undefined && Number(storageCostPerKgPerDay) >= 0)
        crop.storageCostPerKgPerDay = Number(storageCostPerKgPerDay);
      if (individualTransportRatePerKg !== undefined && Number(individualTransportRatePerKg) >= 0)
        crop.individualTransportRatePerKg = Number(individualTransportRatePerKg);
      if (pooledTransportRatePerKg !== undefined && Number(pooledTransportRatePerKg) >= 0)
        crop.pooledTransportRatePerKg = Number(pooledTransportRatePerKg);

      store.commit();
      res.json({ cropConstant: crop });
    }
  );

  app.patch(
    '/api/admin/settings',
    requireAuth,
    requireRoles('system_admin', 'fpo_admin'),
    (req: AuthedRequest, res: Response) => {
      const { priceAlertThresholdPct, spoilageAlertThresholdPct, clusterHarvestWindowHours } =
        req.body as Partial<typeof store.getState extends () => infer R ? R extends { settings: infer S } ? S : never : never>;
      const settings = store.getState().settings;
      if (priceAlertThresholdPct !== undefined)
        settings.priceAlertThresholdPct = Number(priceAlertThresholdPct);
      if (spoilageAlertThresholdPct !== undefined)
        settings.spoilageAlertThresholdPct = Number(spoilageAlertThresholdPct);
      if (clusterHarvestWindowHours !== undefined)
        settings.clusterHarvestWindowHours = Number(clusterHarvestWindowHours);
      store.commit();
      res.json({ settings });
    }
  );

  // =========================================================================
  // VITE DEV / PRODUCTION STATIC SERVING
  // =========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgriNexus server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AgriNexus server:', err);
  process.exit(1);
});
