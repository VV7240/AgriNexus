import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Cpu,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Settings,
  Shield,
  Sliders,
  Sprout,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { AddBatchView } from './components/AddBatchView';
import { AdminConsoleView } from './components/AdminConsoleView';
import { AgriNexusAssistView } from './components/AgriNexusAssistView';
import { AuthScreen } from './components/AuthScreen';
import { BatchDetailView } from './components/BatchDetailView';
import { ClusterPoolingView } from './components/ClusterPoolingView';
import { DashboardView } from './components/DashboardView';
import { MarketPricesView } from './components/MarketPricesView';
import { NotificationsView } from './components/NotificationsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { WhatIfSimulatorView } from './components/WhatIfSimulatorView';
import {
  api,
  ApiError,
  cacheOfflineData,
  clearQueuedOfflineBatches,
  clearSession,
  enqueueOfflineBatch,
  getCachedOfflineData,
  getOfflineMode,
  getQueuedOfflineBatches,
  getStoredToken,
  getStoredUser,
  saveSession,
  setOfflineModeStorage,
} from './services/api';
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
  User,
} from './types';
import { getRoleLabel, t } from './utils/i18n';
import { enrichBatch } from './utils/prediction';

type PageId =
  | 'dashboard'
  | 'add-batch'
  | 'batch-detail'
  | 'simulator'
  | 'clusters'
  | 'markets'
  | 'assist'
  | 'reports'
  | 'notifications'
  | 'admin'
  | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && !storedToken) {
      clearSession();
      return null;
    }
    return storedUser;
  });
  const [language, setLanguage] = useState<Language>(
    () => getStoredUser()?.languagePreference ?? 'en'
  );
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [offlineMode, setOfflineMode] = useState<boolean>(() => getOfflineMode());
  const [pendingQueue, setPendingQueue] = useState<Batch[]>(() =>
    getQueuedOfflineBatches()
  );

  const [batches, setBatches] = useState<EnrichedBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [cropConstants, setCropConstants] = useState<CropConstant[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [priceThresholdPct, setPriceThresholdPct] = useState(5);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reportsData, setReportsData] = useState<{
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
  } | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(
    async (activeUser: User, isOffline: boolean) => {
      if (isOffline) {
        const cached = getCachedOfflineData();
        setBatches(cached.batches);
        setMarketPrices(cached.prices);
        setCropConstants(cached.crops);
        if (cached.batches[0]) setSelectedBatchId(cached.batches[0].id);
        return;
      }

      setLoadingData(true);
      try {
        const [cropsRes, batchesRes, pricesRes, clustersRes, notifRes, scenariosRes, chatRes] =
          await Promise.all([
            api.getCrops(),
            api.getBatches(),
            api.getMarketPrices(),
            api.getClusters(),
            api.getNotifications(),
            api.getScenarios(),
            api.getAssistHistory(),
          ]);

        setCropConstants(cropsRes.cropConstants);
        setBatches(batchesRes.batches);
        setMarketPrices(pricesRes.marketPrices);
        setPriceThresholdPct(pricesRes.priceAlertThresholdPct);
        setClusters(clustersRes.clusters);
        setNotifications(notifRes.notifications);
        setSavedScenarios(scenariosRes.scenarios);
        setChatMessages(chatRes.messages);

        if (batchesRes.batches.length > 0) {
          setSelectedBatchId((prev) =>
            prev && batchesRes.batches.some((b) => b.id === prev)
              ? prev
              : batchesRes.batches[0].id
          );
        }

        cacheOfflineData({
          batches: batchesRes.batches,
          prices: pricesRes.marketPrices,
          crops: cropsRes.cropConstants,
        });

        if (activeUser.role !== 'buyer') {
          const rep = await api.getReportsSummary();
          setReportsData(rep);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          setUser(null);
          return;
        }
        console.warn('Falling back to offline cached data:', err);
        const cached = getCachedOfflineData();
        if (cached.batches.length > 0) {
          setBatches(cached.batches);
          setMarketPrices(cached.prices);
          setCropConstants(cached.crops);
        }
      } finally {
        setLoadingData(false);
      }
    },
    []
  );

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setUser(null);
      setBatches([]);
      setClusters([]);
    };
    window.addEventListener('agrinexus:unauthorized', onUnauthorized);
    return () => window.removeEventListener('agrinexus:unauthorized', onUnauthorized);
  }, []);

  // Initial session validation & ?autostart=1 support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';
    const token = getStoredToken();

    if (!token && autostart) {
      api
        .demoLogin('farmer')
        .then((res) => {
          saveSession(res.token, res.user);
          setUser(res.user);
          setLanguage(res.user.languagePreference);
          loadWorkspaceData(res.user, offlineMode);
        })
        .catch(() => {});
      return;
    }

    if (token && user) {
      loadWorkspaceData(user, offlineMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  }

  function handleAuthSuccess(token: string, loggedUser: User) {
    saveSession(token, loggedUser);
    setUser(loggedUser);
    setLanguage(loggedUser.languagePreference);
    setActivePage('dashboard');
    loadWorkspaceData(loggedUser, offlineMode);
  }

  function handleSignOut() {
    clearSession();
    setUser(null);
    setBatches([]);
    setClusters([]);
    setActivePage('dashboard');
  }

  async function handleLanguageChange(nextLang: Language) {
    setLanguage(nextLang);
    if (user) {
      const updated = { ...user, languagePreference: nextLang };
      setUser(updated);
      const token = getStoredToken();
      if (token) saveSession(token, updated);
      if (!offlineMode) {
        await api.updatePreferences({ languagePreference: nextLang }).catch(() => {});
      }
    }
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  }

  async function handleSyncQueue() {
    if (pendingQueue.length === 0 || !user) return;
    try {
      const res = await api.syncOfflineBatches(pendingQueue);
      clearQueuedOfflineBatches();
      setPendingQueue([]);
      setBatches(res.batches);
      await loadWorkspaceData(user, false);
      showToast(`Synced ${res.syncedCount} offline batch(es) to server.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to sync offline batches.');
    }
  }

  function handleToggleOffline(enabled: boolean) {
    setOfflineMode(enabled);
    setOfflineModeStorage(enabled);
    if (!enabled && user) {
      if (pendingQueue.length > 0) {
        void handleSyncQueue();
      } else {
        loadWorkspaceData(user, false);
        showToast('Back online · Live data synced.');
      }
    } else {
      showToast('Offline mode enabled · Writes will queue locally.');
    }
  }

  async function handleCreateBatch(payload: Partial<Batch>) {
    if (!user) return;
    if (offlineMode) {
      const cropConst =
        cropConstants.find((c) => c.crop === payload.crop) ?? cropConstants[0];
      const nowIso = new Date().toISOString();
      const offlineBatch: Batch = {
        id: `OFF-${Math.floor(1000 + Math.random() * 8999)}`,
        farmerId: user.id,
        farmerName: user.name,
        fpoId: user.fpoId,
        crop: payload.crop || 'Tomato',
        quantityKg: Number(payload.quantityKg || 500),
        harvestTime: payload.harvestTime || nowIso,
        locality: payload.locality || user.locality,
        ambientTempC: payload.ambientTempC ?? cropConst?.defaultAmbientTempC ?? 28,
        initialQuality:
          payload.initialQuality ?? cropConst?.defaultInitialQuality ?? 95,
        storageMode: payload.storageMode ?? 'ambient',
        photoDataUrl: payload.photoDataUrl,
        notes: payload.notes,
        status: 'active',
        pendingSync: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const nextQueue = enqueueOfflineBatch(offlineBatch);
      setPendingQueue(nextQueue);
      if (cropConst) {
        const enriched = enrichBatch(offlineBatch, cropConstants, marketPrices);
        setBatches((prev) => [enriched, ...prev]);
        setSelectedBatchId(enriched.id);
      }
      setActivePage('dashboard');
      showToast('Batch saved offline and queued for sync.');
      return;
    }

    const res = await api.createBatch(payload);
    await loadWorkspaceData(user, false);
    if (res.batch) {
      setSelectedBatchId(res.batch.id);
    }
    setActivePage('dashboard');
    showToast(`Batch ${res.batch?.id ?? ''} registered with live Digital Twin.`);
  }

  async function handleUpdateBatch(id: string, payload: Partial<Batch>) {
    if (!user) return;
    await api.updateBatch(id, payload);
    await loadWorkspaceData(user, offlineMode);
  }

  async function handleConfirmAction(id: string, action: ActionType) {
    if (!user) return;
    if (offlineMode) {
      setBatches((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, status: 'action_confirmed', confirmedAction: action }
            : b
        )
      );
      showToast(`Action (${action}) confirmed locally.`);
      return;
    }
    try {
      await api.confirmBatchAction(id, action);
      await loadWorkspaceData(user, false);
      showToast(`Action (${action.toUpperCase()}) confirmed for batch ${id}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to confirm action.');
    }
  }

  async function handleLogOutcome(
    id: string,
    payload: {
      actualActionTaken: ActionType;
      actualValueRealisedInr: number;
      actualSpoilagePct: number;
    }
  ) {
    if (!user) return;
    try {
      await api.logBatchOutcome(id, payload);
      await loadWorkspaceData(user, false);
      showToast('Actual outcome recorded for ML model training.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to log outcome.');
    }
  }

  async function handleConfirmCluster(clusterId: string) {
    if (!user) return;
    try {
      await api.confirmCluster(clusterId);
      await loadWorkspaceData(user, false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to confirm cluster.');
    }
  }

  async function handleExpressInterest(clusterId: string, note = 'Interested in pooled lot') {
    if (!user) return;
    try {
      await api.expressBuyerInterest(clusterId, note);
      await loadWorkspaceData(user, false);
      showToast(`Procurement interest sent for ${clusterId}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to record interest.');
    }
  }

  if (!user) {
    return (
      <AuthScreen
        language={language}
        onLanguageChange={setLanguage}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const selectedBatch =
    batches.find((b) => b.id === selectedBatchId) ?? batches[0];

  const rawNavItems: Array<{
    id: PageId;
    label: string;
    icon: React.ReactNode;
    roles: User['role'][];
    badge?: number;
  }> = [
    {
      id: 'dashboard',
      label: t(language, 'navDashboard'),
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'buyer', 'system_admin'],
    },
    {
      id: 'add-batch',
      label: t(language, 'navAddBatch'),
      icon: <PlusCircle className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'system_admin'],
    },
    {
      id: 'batch-detail',
      label: t(language, 'navDecision'),
      icon: <Cpu className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'system_admin'],
    },
    {
      id: 'simulator',
      label: t(language, 'navSimulator'),
      icon: <Sliders className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'system_admin'],
    },
    {
      id: 'clusters',
      label: t(language, 'navClusters'),
      icon: <Layers className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'buyer', 'system_admin'],
    },
    {
      id: 'markets',
      label: t(language, 'navMarkets'),
      icon: <TrendingUp className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'buyer', 'system_admin'],
    },
    {
      id: 'assist',
      label: t(language, 'navAssist'),
      icon: <MessageSquare className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'buyer', 'system_admin'],
    },
    {
      id: 'reports',
      label: t(language, 'navReports'),
      icon: <BarChart3 className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'system_admin'],
    },
    {
      id: 'notifications',
      label: t(language, 'navNotifications'),
      icon: <Bell className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'buyer', 'system_admin'],
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      id: 'admin',
      label: t(language, 'navAdmin'),
      icon: <Shield className="w-4 h-4" />,
      roles: ['fpo_admin', 'system_admin'],
    },
    {
      id: 'settings',
      label: t(language, 'navSettings'),
      icon: <Settings className="w-4 h-4" />,
      roles: ['farmer', 'fpo_admin', 'buyer', 'system_admin'],
    },
  ];
  const navItems = rawNavItems.filter((item) => item.roles.includes(user.role));

  const currentNavLabel =
    navItems.find((i) => i.id === activePage)?.label ?? t(language, 'navDashboard');

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex">
      {/* Sidebar Navigation (256px desktop, drawer on mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#E2E6DF] flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="px-5 py-4 border-b border-[#E2E6DF] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setActivePage('dashboard');
                setMobileNavOpen(false);
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <Sprout className="w-5 h-5 text-emerald-700 shrink-0" />
              <span className="font-display text-lg font-bold tracking-tight text-[#141A15]">
                {t(language, 'brand')}
              </span>
            </button>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1 text-[#4B554D]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePage(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'text-[#4B554D] hover:bg-[#F1F3EF] hover:text-[#141A15]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        isActive ? 'text-white' : 'text-red-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Sign Out Footer */}
          <div className="p-4 border-t border-[#E2E6DF] space-y-3">
            <div>
              <div className="text-sm font-semibold text-[#141A15] truncate">{user.name}</div>
              <div className="text-xs text-[#647066] truncate">
                {getRoleLabel(language, user.role)} · {user.locality}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-[#4B554D] border border-[#D4D9D0] rounded-lg hover:bg-[#F7F8F6] hover:text-[#141A15]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t(language, 'signOut')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, concise utility & primary action on right */}
        <header className="bg-white border-b border-[#E2E6DF] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-[#141A15] border border-[#D4D9D0] rounded-lg"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium text-[#647066] truncate">
              <span className="text-[#141A15] font-semibold">{user.fpoName}</span>
              <span className="mx-2">/</span>
              <span>{currentNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleOffline(!offlineMode)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                offlineMode
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-[#F7F8F6] border-[#D4D9D0] text-[#4B554D] hover:text-[#141A15]'
              }`}
            >
              {offlineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>{offlineMode ? t(language, 'offlineMode') : t(language, 'onlineMode')}</span>
            </button>

            {pendingQueue.length > 0 && !offlineMode && (
              <button
                type="button"
                onClick={handleSyncQueue}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {t(language, 'syncNow')} ({pendingQueue.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleLanguageChange(language === 'en' ? 'hi' : 'en')}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#D4D9D0] text-[#141A15] rounded-lg hover:bg-[#F7F8F6] whitespace-nowrap shrink-0"
            >
              {language === 'en' ? 'हिन्दी' : 'English'}
            </button>
          </div>
        </header>

        {toastMsg && (
          <div className="mx-4 sm:mx-8 mt-4 px-4 py-2.5 bg-emerald-800 text-white text-xs font-medium rounded-lg">
            {toastMsg}
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mx-4 sm:mx-8 mt-4 px-4 py-2.5 bg-red-50 border border-red-200 text-red-800 text-xs font-medium rounded-lg"
          >
            {errorMsg}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {loadingData && batches.length === 0 ? (
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-8 text-sm text-[#647066]">
              Loading post-harvest intelligence...
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardView
                  user={user}
                  language={language}
                  batches={batches}
                  clusters={clusters}
                  marketPrices={marketPrices}
                  pendingSyncCount={pendingQueue.length}
                  offlineMode={offlineMode}
                  onSelectBatch={(id) => {
                    setSelectedBatchId(id);
                    setActivePage('batch-detail');
                  }}
                  onConfirmAction={handleConfirmAction}
                  onNavigate={(p) => setActivePage(p as PageId)}
                  onExpressBuyerInterest={(id) => handleExpressInterest(id)}
                />
              )}

              {activePage === 'add-batch' && (
                <AddBatchView
                  user={user}
                  language={language}
                  cropConstants={cropConstants}
                  offlineMode={offlineMode}
                  onSubmitBatch={handleCreateBatch}
                  onCancel={() => setActivePage('dashboard')}
                />
              )}

              {activePage === 'batch-detail' &&
                (selectedBatch ? (
                  <BatchDetailView
                    batch={selectedBatch}
                    allBatches={batches}
                    language={language}
                    onSelectBatchId={(id) => setSelectedBatchId(id)}
                    onBack={() => setActivePage('dashboard')}
                    onUpdateBatch={handleUpdateBatch}
                    onConfirmAction={handleConfirmAction}
                    onLogOutcome={handleLogOutcome}
                    onOpenSimulator={(id) => {
                      setSelectedBatchId(id);
                      setActivePage('simulator');
                    }}
                    onOpenAssist={(id) => {
                      setSelectedBatchId(id);
                      setActivePage('assist');
                    }}
                  />
                ) : (
                  <div className="bg-white border border-[#E2E6DF] rounded-xl p-8 text-center text-sm text-[#647066]">
                    {t(language, 'registerFirstBatch')}
                  </div>
                ))}

              {activePage === 'simulator' && (
                <WhatIfSimulatorView
                  batches={batches}
                  cropConstants={cropConstants}
                  marketPrices={marketPrices}
                  savedScenarios={savedScenarios}
                  language={language}
                  initialBatchId={selectedBatch?.id}
                  onSaveScenario={async (payload) => {
                    if (offlineMode) {
                      setSavedScenarios((prev) => [
                        {
                          ...payload,
                          id: `SCN-${Date.now()}`,
                          userId: user.id,
                          createdAt: new Date().toISOString(),
                        },
                        ...prev,
                      ]);
                      return;
                    }
                    const res = await api.saveScenario(payload);
                    setSavedScenarios((prev) => [res.scenario, ...prev]);
                  }}
                />
              )}

              {activePage === 'clusters' && (
                <ClusterPoolingView
                  user={user}
                  language={language}
                  clusters={clusters}
                  onConfirmCluster={handleConfirmCluster}
                  onExpressInterest={handleExpressInterest}
                />
              )}

              {activePage === 'markets' && (
                <MarketPricesView
                  user={user}
                  language={language}
                  marketPrices={marketPrices}
                  priceAlertThresholdPct={priceThresholdPct}
                  onRefreshFeed={async () => {
                    const res = await api.refreshMarketPrices();
                    setMarketPrices(res.marketPrices);
                    await loadWorkspaceData(user, false);
                    showToast('Mandi prices synced with Agmarknet / eNAM.');
                  }}
                  onOverridePrice={async (id, pricePerKg) => {
                    await api.overrideMarketPrice(id, pricePerKg);
                    await loadWorkspaceData(user, false);
                    showToast('Market price overridden and batches recomputed.');
                  }}
                />
              )}

              {activePage === 'assist' && (
                <AgriNexusAssistView
                  language={language}
                  batches={batches}
                  marketPrices={marketPrices}
                  offlineMode={offlineMode}
                  initialBatchId={selectedBatch?.id}
                  initialMessages={chatMessages}
                  onMessagesChange={setChatMessages}
                />
              )}

              {activePage === 'reports' && reportsData && (
                <ReportsView
                  language={language}
                  summary={reportsData.summary}
                  outcomes={reportsData.outcomes}
                  transportComparison={reportsData.transportComparison}
                />
              )}

              {activePage === 'notifications' && (
                <NotificationsView
                  language={language}
                  notifications={notifications}
                  onMarkAllRead={async () => {
                    if (!offlineMode) await api.markNotificationsRead();
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  }}
                  onInspectBatch={(batchId) => {
                    setSelectedBatchId(batchId);
                    setActivePage('batch-detail');
                  }}
                />
              )}

              {activePage === 'admin' && (
                <AdminConsoleView
                  currentUser={user}
                  language={language}
                  onConstantsUpdated={() => loadWorkspaceData(user, false)}
                />
              )}

              {activePage === 'settings' && (
                <SettingsView
                  user={user}
                  language={language}
                  offlineMode={offlineMode}
                  pendingSyncCount={pendingQueue.length}
                  onLanguageChange={handleLanguageChange}
                  onToggleOffline={handleToggleOffline}
                  onSyncNow={handleSyncQueue}
                  onUpdateProfile={async ({ name, locality }) => {
                    const res = await api.updatePreferences({ name, locality });
                    setUser(res.user);
                    const token = getStoredToken();
                    if (token) saveSession(token, res.user);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
