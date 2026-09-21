import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, Fingerprint, RefreshCw, Smartphone } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

// Types
import {
  BlockchainAnchor,
  CommunityFundMovement,
  CommunityResource,
  Cooperative,
  Order,
  Producer,
  Product,
  Profile,
  ResourceReservation,
  TraceabilityStage,
  UserRole,
  MaterialItem,
  ProducerSettlementSummary,
  CooperativeSettlementProducerSummary,
  ProducerSettlement,
} from "./types";

// Components
import Navbar, { NavNotification } from "./components/Navbar";
import AuthPanel from "./components/AuthPanel";
import CartPanel from "./components/CartPanel";
import TraceModal from "./components/TraceModal";
import NfcOpenCard from "./components/NfcOpenCard";

// Views
import MarketplaceView from "./views/MarketplaceView";
import PurchasesView from "./views/PurchasesView";
import ProducerView from "./views/ProducerView";
import CooperativeView from "./views/CooperativeView";
import InventoryView from "./views/InventoryView";
import FundView from "./views/FundView";
import AdminView from "./views/AdminView";
import PublicTracePage from "./views/PublicTracePage";
import SettlementPanel from "./components/SettlementPanel";

type CoreTab = "marketplace" | "purchases" | "producer" | "cooperative" | "inventory" | "fund" | "admin";
type Tab = CoreTab | "account" | "cart";
type MarketplaceFilters = {
  sort: "recent" | "price_asc" | "price_desc" | "stock_desc";
  maxPrice: "all" | "500" | "1000" | "1500";
  material: "all" | string;
  onlyAvailable: boolean;
  minProducerShare: "all" | "60" | "70";
};
type AppNotification = NavNotification & {
  action: "restock" | "openPurchases" | "openCooperative" | "openProducer" | "openInventory" | "openFund";
  productId?: string;
};
type RewardBalance = {
  earnedPoints: number;
  redeemedPoints: number;
  availablePoints: number;
  mxnPerPoint: number;
  maxCheckoutPercent: number;
};

function getFriendlyError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (/rate limit|too many requests|429/i.test(error.message)) {
    return "Supabase limitó temporalmente la autenticación. Espera un momento e intenta iniciar sesión otra vez.";
  }
  if (/failed to fetch|network/i.test(error.message)) {
    return `No se pudo conectar con el servidor. Verifica que ${window.location.origin} esté activo.`;
  }
  return error.message || fallback;
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "customer" as UserRole,
    community: "",
    cooperativeId: "coop-1",
  });
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("marketplace");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [resources, setResources] = useState<CommunityResource[]>([]);
  const [reservations, setReservations] = useState<ResourceReservation[]>([]);
  const [fundMovements, setFundMovements] = useState<CommunityFundMovement[]>([]);
  const [fundBalance, setFundBalance] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<Order[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const todayForSettlement = new Date();
  const [settlementPeriod, setSettlementPeriod] = useState({
    from: new Date(todayForSettlement.getFullYear(), todayForSettlement.getMonth(), 1).toISOString().slice(0, 10),
    to: todayForSettlement.toISOString().slice(0, 10),
  });
  const [producerSettlement, setProducerSettlement] = useState<ProducerSettlementSummary | null>(null);
  const [cooperativeSettlement, setCooperativeSettlement] = useState<{
    period_start: string;
    period_end: string;
    producers: CooperativeSettlementProducerSummary[];
    settlements: ProducerSettlement[];
  } | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const checkoutHandledRef = useRef(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [marketplaceFilters, setMarketplaceFilters] = useState<MarketplaceFilters>({
    sort: "recent",
    maxPrice: "all",
    material: "all",
    onlyAvailable: false,
    minProducerShare: "all",
  });
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [traceStages, setTraceStages] = useState<TraceabilityStage[]>([]);
  const [anchors, setAnchors] = useState<BlockchainAnchor[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showNfcOpenCard, setShowNfcOpenCard] = useState(false);
  const [nfcWriteState, setNfcWriteState] = useState<"idle" | "waiting" | "success" | "error">("idle");
  const [nfcReaderState, setNfcReaderState] = useState<"idle" | "prompt" | "scanning" | "detected">("idle");
  const [nfcDetectedName, setNfcDetectedName] = useState("");
  const [showNfcToast, setShowNfcToast] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const nfcReaderAbortRef = useRef<AbortController | null>(null);
  const nfcReaderRef = useRef<any>(null);
  const nfcLastReadRef = useRef<{ code: string; at: number } | null>(null);
  const nfcReadBusyRef = useRef(false);
  const [nfcWriteProgress, setNfcWriteProgress] = useState(0);
  const nfcWriteTimerRef = useRef<number | null>(null);
  const [publicTrace, setPublicTrace] = useState<{
    product: Product;
    stages: TraceabilityStage[];
    anchors: BlockchainAnchor[];
  } | null>(null);

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    category: "Textiles bordados",
    price: "",
    materials: "",
    materialItems: [] as MaterialItem[],
    materialsCost: 0,
    laborCost: 0,
    communityFund: "",
    platformCommission: 0,
    craftHours: "",
    producerId: "",
    stock: "",
    image: "",
    images: [] as string[],
  });

  const [resourceForm, setResourceForm] = useState({
    name: "",
    type: "insumo" as "insumo" | "maquinaria",
    description: "",
    quantity: "",
    unit: "",
    rentalCost: "",
  });

  const [reservationForm, setReservationForm] = useState({
    resourceId: "",
    quantity: 1,
    startDate: "",
    endDate: "",
    notes: "",
  });

  const [shippingForm, setShippingForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
  });
  const emptyShippingForm = {
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
  };
  const emptyAuthForm = {
    email: "",
    password: "",
    fullName: "",
    role: "customer" as UserRole,
    community: "",
    cooperativeId: "coop-1",
  };
  const [saveDeliveryInfo, setSaveDeliveryInfo] = useState(false);
  const [rewardBalance, setRewardBalance] = useState<RewardBalance>({
    earnedPoints: 0,
    redeemedPoints: 0,
    availablePoints: 0,
    mxnPerPoint: 1,
    maxCheckoutPercent: 20,
  });
  const [useRewardPoints, setUseRewardPoints] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const activeUserKey = session?.user.id || "guest";
  const cartStorageKey = `jnatjo-cart:${activeUserKey}`;
  const shippingStorageKey = `jnatjo-shipping:${activeUserKey}`;
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const notificationTimersRef = useRef<Map<string, number>>(new Map());
  const notificationSeenRef = useRef<Set<string>>(new Set());
  const notificationActionLocksRef = useRef<Set<string>>(new Set());

  const [sensorForm, setSensorForm] = useState({
    productId: "",
    sensorType: "temperature",
    value: "",
    unit: "",
    location: "",
  });

  const [routeTick, setRouteTick] = useState(0);

  const publicTraceCode = useMemo(() => {
    const match = window.location.pathname.match(/^\/trazabilidad\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [routeTick]);

  useEffect(() => {
    const onPopState = () => setRouteTick((value) => value + 1);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Calculate visible tabs based on user role
  const visibleTabs = useMemo<CoreTab[]>(() => {
    if (!profile) return ["marketplace"];
    switch (profile.role) {
      case "customer":
        return ["marketplace", "purchases"];
      case "producer":
        return ["marketplace", "producer", "inventory"];
      case "cooperative":
      case "verifier":
      case "inventory_manager":
        return ["marketplace", "producer", "cooperative", "inventory", "fund"];
      case "admin":
        return ["marketplace", "producer", "cooperative", "inventory", "fund", "admin"];
      default:
        return ["marketplace"];
    }
  }, [profile]);

  // Auth headers for real Supabase sessions.
  async function authHeaders() {
    const current = await supabase.auth.getSession();
    const token = current.data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
      ...(options.headers || {}),
    };
    const response = await fetch(url, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof body === "string" ? body : body.error || "Error de API";
      throw new Error(`${response.status} ${response.statusText}: ${message}`);
    }
    return body as T;
  }

  async function loadPublicData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [productRows, coopRows, producerRows, resourceRows, fund] = await Promise.all([
        api<Product[]>("/api/products?includePending=true"),
        api<Cooperative[]>("/api/cooperatives"),
        api<Producer[]>("/api/producers"),
        api<CommunityResource[]>("/api/resources"),
        api<{ balance: number; movements: CommunityFundMovement[] }>("/api/community-fund"),
      ]);
      setProducts(Array.isArray(productRows) ? productRows : []);
      setCooperatives(Array.isArray(coopRows) ? coopRows : []);
      setProducers(Array.isArray(producerRows) ? producerRows : []);
      setResources(Array.isArray(resourceRows) ? resourceRows : []);
      setFundBalance(fund?.balance ?? 0);
      setFundMovements(Array.isArray(fund?.movements) ? fund.movements : []);
      if (!reservationForm.resourceId && resourceRows[0]) {
        setReservationForm((prev) => ({ ...prev, resourceId: resourceRows[0].id }));
      }
      if (!sensorForm.productId && productRows[0]) {
        setSensorForm((prev) => ({ ...prev, productId: productRows[0].id }));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadPrivateData() {
    if (!session) return;
    try {
      const [profileRow, reservationRows, purchaseRows, salesRows, adminOrderRows, movementRows, rewards] = await Promise.all([
        api<Profile>("/api/auth/profile"),
        api<ResourceReservation[]>("/api/resources/reservations"),
        api<Order[]>("/api/orders?scope=purchases"),
        api<Order[]>("/api/orders?scope=sales"),
        api<Order[]>("/api/orders?scope=operations"),
        api<any[]>("/api/resources/movements"),
        api<RewardBalance>("/api/rewards/balance"),
      ]);
      setProfile(profileRow);
      setReservations(Array.isArray(reservationRows) ? reservationRows : []);
      setPurchaseOrders(Array.isArray(purchaseRows) ? purchaseRows : []);
      setSalesOrders(Array.isArray(salesRows) ? salesRows : []);
      setOrders(Array.isArray(adminOrderRows) ? adminOrderRows : []);
      setMovements(Array.isArray(movementRows) ? movementRows : []);
      setRewardBalance(rewards && typeof rewards === 'object' ? rewards : { earnedPoints: 0, redeemedPoints: 0, availablePoints: 0, mxnPerPoint: 1, maxCheckoutPercent: 20 });

      if (profileRow.role === "producer") {
        setProducerSettlement(await api<ProducerSettlementSummary>(`/api/settlements/producer?from=${settlementPeriod.from}&to=${settlementPeriod.to}`));
        setCooperativeSettlement(null);
      } else if (["cooperative", "inventory_manager", "admin"].includes(profileRow.role)) {
        setCooperativeSettlement(await api<{
          period_start: string;
          period_end: string;
          producers: CooperativeSettlementProducerSummary[];
          settlements: ProducerSettlement[];
        }>(`/api/settlements/cooperative?from=${settlementPeriod.from}&to=${settlementPeriod.to}`));
        setProducerSettlement(null);
      } else {
        setProducerSettlement(null);
        setCooperativeSettlement(null);
      }

      if (profileRow.role === "admin") {
        const adminProfileRows = await api<Profile[]>("/api/admin/profiles");
        setAdminProfiles(adminProfileRows);
      } else {
        setAdminProfiles([]);
      }
    } catch (error) {
      console.warn(error);
    }
  }

  async function reloadSettlements() {
    if (!session || !profile) return;
    try {
      if (profile.role === "producer") {
        setProducerSettlement(await api<ProducerSettlementSummary>(`/api/settlements/producer?from=${settlementPeriod.from}&to=${settlementPeriod.to}`));
      } else if (["cooperative", "inventory_manager", "admin"].includes(profile.role)) {
        setCooperativeSettlement(await api<{
          period_start: string;
          period_end: string;
          producers: CooperativeSettlementProducerSummary[];
          settlements: ProducerSettlement[];
        }>(`/api/settlements/cooperative?from=${settlementPeriod.from}&to=${settlementPeriod.to}`));
      }
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudieron actualizar las liquidaciones."));
    }
  }

  async function createProducerSettlement(producerId: string) {
    try {
      await api("/api/settlements", {
        method: "POST",
        body: JSON.stringify({
          producerId,
          periodStart: settlementPeriod.from,
          periodEnd: settlementPeriod.to,
        }),
      });
      setAuthMessage("Corte de liquidación creado correctamente.");
      await reloadSettlements();
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo crear el corte de liquidación."));
    }
  }

  async function payProducerSettlement(
    settlementId: string,
    paymentMethod: "transferencia" | "efectivo" | "deposito" | "otro",
    paymentReference: string,
    notes: string,
  ) {
    try {
      await api(`/api/settlements/${settlementId}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod, paymentReference, notes }),
      });
      setAuthMessage("Pago de liquidación registrado.");
      await reloadSettlements();
    } catch (error) {
      throw new Error(getFriendlyError(error, "No se pudo registrar el pago de la liquidación."));
    }
  }

  async function loadPublicTrace(traceCode: string) {
    const data = await api<{ product: Product; stages: TraceabilityStage[]; anchors: BlockchainAnchor[] }>(
      `/api/traceability/code/${encodeURIComponent(traceCode)}`,
    );
    setPublicTrace(data);
    return data;
  }

  async function confirmReceiptFromTrace(
    productId: string,
    input: { producerRating: number; deliveryRating: number; comments: string },
  ) {
    const result = await api<{ success: boolean; rewardPoints: number; alreadyConfirmed?: boolean }>(
      `/api/products/${productId}/confirm-receipt`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    if (publicTraceCode) await loadPublicTrace(publicTraceCode);
    await Promise.all([loadPublicData(), loadPrivateData()]);
    return result;
  }

  const checkoutParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const checkout = searchParams.get("checkout");
    const order = searchParams.get("order");
    return { checkout, order };
  }, []);

  async function confirmPayment(orderId: string) {
    setConfirmingPayment(true);
    try {
      await api<{ success: boolean }>("/api/checkout/confirm", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });
      setCart([]); // Limpiar el carrito al confirmar la compra
      setAuthMessage("¡Pago verificado exitosamente con Stripe! Su orden de comercio justo ha sido registrada.");
      await Promise.all([loadPublicData(), loadPrivateData()]);
      setTab("purchases");
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "Error al confirmar el pago de la orden."));
    } finally {
      setConfirmingPayment(false);
      window.history.pushState({}, "", "/");
    }
  }

  useEffect(() => {
    if (checkoutHandledRef.current) return;
    if (!authReady) return;

    if (checkoutParams.checkout === "success" && checkoutParams.order) {
      checkoutHandledRef.current = true;
      confirmPayment(checkoutParams.order);
    } else if (checkoutParams.checkout === "cancelled" && checkoutParams.order) {
      checkoutHandledRef.current = true;
      api<{ success: boolean }>("/api/checkout/cancel", {
        method: "POST",
        body: JSON.stringify({ orderId: checkoutParams.order }),
      }).catch(() => undefined);
      setAuthMessage("El pago fue cancelado. Tus puntos de recompensa reservados fueron liberados.");
      window.history.pushState({}, "", "/");
      loadPrivateData();
    }
  }, [authReady, checkoutParams, session]);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall as EventListener);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (window.localStorage.getItem("jnanto_nfc_enabled") === "1" && (window as any).NDEFReader && !publicTraceCode) {
        // Algunos móviles suspenden temporalmente Web NFC al cambiar de foco.
        // Al volver al sitio, rearmamos el lector sin pedir permiso otra vez.
        window.setTimeout(() => {
          if (nfcReaderState === "idle") void startNfcReader();
        }, 250);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [publicTraceCode, nfcReaderState]);

  useEffect(() => {
    if (publicTraceCode) return;
    const NDEFReader = (window as any).NDEFReader;
    const enabled = window.localStorage.getItem("jnanto_nfc_enabled") === "1";
    if (NDEFReader && window.innerWidth <= 900 && !enabled) {
      const timer = window.setTimeout(() => setNfcReaderState("prompt"), 700);
      return () => window.clearTimeout(timer);
    }
  }, [publicTraceCode]);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (publicTraceCode) {
      setShowNfcOpenCard(false);
      loadPublicTrace(publicTraceCode).then(() => setShowNfcOpenCard(true)).catch((error) => setAuthMessage(error.message));
    } else {
      loadPublicData().catch((error) => setAuthMessage(error.message));
    }
  }, [publicTraceCode]);

  useEffect(() => {
    loadPrivateData();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      loadPrivateData();
      if (!publicTraceCode) loadPublicData(true).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [session?.user.id, publicTraceCode]);

  useEffect(() => {
    setCartHydrated(false);
    try {
      const savedCart = localStorage.getItem(cartStorageKey);
      setCart(savedCart ? JSON.parse(savedCart) : []);
      const savedShipping = localStorage.getItem(shippingStorageKey);
      if (savedShipping) {
        setShippingForm({ ...emptyShippingForm, ...JSON.parse(savedShipping) });
        setSaveDeliveryInfo(true);
      } else {
        setShippingForm(emptyShippingForm);
        setSaveDeliveryInfo(false);
      }
    } catch {
      setCart([]);
      setShippingForm(emptyShippingForm);
      setSaveDeliveryInfo(false);
    } finally {
      setCartHydrated(true);
    }
  }, [cartStorageKey, shippingStorageKey]);

  useEffect(() => {
    if (!cartHydrated) return;
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartHydrated, cartStorageKey]);

  useEffect(() => {
    setDismissedNotificationIds([]);
    notificationTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    notificationTimersRef.current.clear();
    notificationSeenRef.current.clear();
  }, [session?.user.id]);

  function dismissNotification(id: string) {
    const timer = notificationTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      notificationTimersRef.current.delete(id);
    }
    setDismissedNotificationIds((current) => Array.from(new Set([...current, id])));
  }

  async function runLockedAction<T>(key: string, task: () => Promise<T>): Promise<T | undefined> {
    if (notificationActionLocksRef.current.has(key)) return undefined;
    notificationActionLocksRef.current.add(key);
    try {
      return await task();
    } finally {
      notificationActionLocksRef.current.delete(key);
    }
  }

  useEffect(() => {
    if (tab === "cart" && profile && profile.role !== "customer") {
      setTab(visibleTabs[0]);
      return;
    }
    if (tab !== "account" && tab !== "cart" && !visibleTabs.includes(tab)) {
      setTab(visibleTabs[0]);
    }
  }, [profile, tab, visibleTabs]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setAuthMessage(null);
    let nextTabAfterAuth: Tab = "marketplace";
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        setAuthMessage("Sesión iniciada correctamente.");
      } else {
        const registeredRole = authForm.role;
        await api<Profile>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password,
            fullName: authForm.fullName,
            role: authForm.role,
            community: authForm.community,
            cooperativeId: authForm.cooperativeId,
          }),
        });

        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        setAuthMessage("Registro exitoso. Tu panel quedó listo.");
        nextTabAfterAuth = registeredRole === "customer" ? "marketplace" : registeredRole === "producer" ? "producer" : "cooperative";
      }
      setAuthForm(emptyAuthForm);
      await loadPrivateData();
      setTab(nextTabAfterAuth);
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "Error de autenticación."));
    }
  }

  function changeAuthMode(mode: "login" | "register") {
    setAuthMode(mode);
    setAuthForm(emptyAuthForm);
    setAuthMessage(null);
  }

  async function updateProfileSettings(next: { role: UserRole; community: string; cooperativeId: string }) {
    await api<Profile>("/api/auth/profile", {
      method: "POST",
      body: JSON.stringify({
        fullName: profile?.full_name || authForm.fullName,
        role: next.role,
        community: next.community,
        cooperativeId: next.cooperativeId,
      }),
    });
    setAuthMessage("Perfil actualizado. Tu asociación a cooperativa quedó guardada.");
    await Promise.all([loadPublicData(), loadPrivateData()]);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setOrders([]);
    setPurchaseOrders([]);
    setSalesOrders([]);
    setReservations([]);
    setMovements([]);
    setAuthForm(emptyAuthForm);
    setShippingForm(emptyShippingForm);
    setCart([]);
    setProducerSettlement(null);
    setCooperativeSettlement(null);
    setDismissedNotificationIds([]);
    setAuthMessage(null);
    notificationTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    notificationTimersRef.current.clear();
    notificationSeenRef.current.clear();
    setTab("marketplace");
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const normalizedCategory = normalizeText(category);
    const normalizedMaterial = normalizeText(marketplaceFilters.material);
    const maxPrice = marketplaceFilters.maxPrice === "all" ? Infinity : Number(marketplaceFilters.maxPrice);
    const minProducerShare =
      marketplaceFilters.minProducerShare === "all" ? 0 : Number(marketplaceFilters.minProducerShare);

    const safeProducts = Array.isArray(products) ? products : [];
    const rows = safeProducts.filter((product) => {
      if (product.status !== "verified") return false;
      const producerShare = product.breakdown.materialsCost + product.breakdown.laborCost;
      const producerPercent = product.price > 0 ? Math.round((producerShare / product.price) * 100) : 0;
      const searchable = normalizeText([
        product.name,
        product.description,
        product.category,
        product.community,
        product.producerName,
        product.materials.join(" "),
      ].join(" "));
      const matchesCategory = category === "Todos" || normalizeText(product.category) === normalizedCategory;
      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
      const matchesPrice = product.price <= maxPrice;
      const matchesMaterial =
        marketplaceFilters.material === "all" ||
        product.materials.some((material) => normalizeText(material).includes(normalizedMaterial));
      const matchesAvailability = !marketplaceFilters.onlyAvailable || product.stock > 0;
      const matchesProducerShare = producerPercent >= minProducerShare;
      return matchesCategory && matchesSearch && matchesPrice && matchesMaterial && matchesAvailability && matchesProducerShare;
    });

    return [...rows].sort((a, b) => {
      if (marketplaceFilters.sort === "price_asc") return a.price - b.price;
      if (marketplaceFilters.sort === "price_desc") return b.price - a.price;
      if (marketplaceFilters.sort === "stock_desc") return b.stock - a.stock;
      return 0;
    });
  }, [category, marketplaceFilters, products, search]);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const rewardDiscount = useRewardPoints
    ? Math.min(
        rewardBalance.availablePoints,
        Math.floor(cartTotal * (rewardBalance.maxCheckoutPercent / 100)),
      )
    : 0;
  const canShop = !profile || profile.role === "customer";
  const notificationItems = useMemo<AppNotification[]>(() => {
    if (!profile) return [];
    const items: AppNotification[] = [];
    const safeProds = Array.isArray(products) ? products : [];
    const ownProducts =
      profile.role === "producer"
        ? safeProds.filter((product) => product.producerId === profile.id || product.producerName === profile.full_name)
        : ["cooperative", "verifier", "inventory_manager"].includes(profile.role)
          ? safeProds.filter((product) => product.cooperativeId === profile.cooperative_id)
          : safeProds;

    if (["producer", "cooperative", "inventory_manager", "admin"].includes(profile.role)) {
      ownProducts
        .filter((product) => product.stock <= 1)
        .slice(0, 4)
        .forEach((product) => items.push({
          id: `stock:${product.id}:${product.stock}`,
          title: "Abastecimiento pendiente",
          body: `${product.name} tiene ${product.stock} pieza(s) disponible(s).`,
          actionLabel: "Abastecer +1",
          action: "restock",
          productId: product.id,
        }));
    }

    if (["cooperative", "inventory_manager", "admin"].includes(profile.role)) {
      (Array.isArray(fundMovements) ? fundMovements : [])
        .filter((movement) => movement.type === "expense" && movement.approval_status !== "confirmed")
        .slice(0, 4)
        .forEach((movement) => items.push({
          id: `fund-expense:${movement.id}:${movement.approval_status || "pending"}`,
          title: "Gasto pendiente de confirmar",
          body: `${movement.description}: $${Number(movement.amount || 0).toLocaleString("es-MX")} MXN.`,
          actionLabel: "Confirmar gasto",
          action: "openFund",
        }));

      (Array.isArray(resources) ? resources : [])
        .filter((resource) => Number(resource.quantity || 0) <= Number(resource.low_stock_threshold || 0))
        .slice(0, 4)
        .forEach((resource) => items.push({
          id: `resource-stock:${resource.id}:${resource.quantity}`,
          title: "Recurso con bajo inventario",
          body: `${resource.name} tiene ${resource.quantity} ${resource.unit} disponibles.`,
          actionLabel: "Ver inventario",
          action: "openInventory",
        }));

      (Array.isArray(reservations) ? reservations : [])
        .filter((reservation) => reservation.status === "pending")
        .slice(0, 4)
        .forEach((reservation) => items.push({
          id: `reservation:${reservation.id}:${reservation.status}`,
          title: "Préstamo pendiente",
          body: `${reservation.user_name} solicitó ${reservation.resource_name}.`,
          actionLabel: "Atender préstamo",
          action: "openCooperative",
        }));
    }

    if (profile.role === "customer") {
      (Array.isArray(reservations) ? reservations : [])
        .filter((reservation) => reservation.status !== "pending")
        .slice(0, 4)
        .forEach((reservation) => items.push({
          id: `my-reservation:${reservation.id}:${reservation.status}`,
          title: "Estado de préstamo actualizado",
          body: `${reservation.resource_name}: ${reservation.status}.`,
          actionLabel: "Ver inventario",
          action: "openInventory",
        }));
    }

    if (profile.role === "producer") {
      (Array.isArray(salesOrders) ? salesOrders : [])
        .flatMap((order) =>
          (order.order_items || []).map((item) => ({
            order,
            item,
          })),
        )
        .filter(({ order, item }) => {
          const product = safeProds.find((candidate) => candidate.id === item.product_id);
          const isOwnProduct =
            product?.producerId === profile.id ||
            normalizeText(product?.producerName) === normalizeText(profile.full_name);
          return isOwnProduct && ["paid", "shipped", "delivered"].includes(order.status);
        })
        .slice(0, 5)
        .forEach(({ order, item }) => {
          items.push({
            id: `sale:${order.id}:${item.product_id}:${order.status}`,
            title: "Nueva venta confirmada",
            body: `${item.quantity} x ${item.product_name} en orden ${order.id.slice(0, 8).toUpperCase()}.`,
            actionLabel: "Ver ventas",
            action: "openProducer",
            productId: item.product_id,
          });
        });
    }

    if (["cooperative", "verifier", "admin"].includes(profile.role)) {
      safeProds
        .filter((product) => product.status === "pending")
        .slice(0, 4)
        .forEach((product) => items.push({
          id: `validate:${product.id}`,
          title: "Validación comunitaria",
          body: `${product.name} está pendiente de validación.`,
          actionLabel: "Atender en Cooperativa",
          action: "openCooperative",
          productId: product.id,
        }));
    }

    if (profile.role === "customer") {
      (Array.isArray(purchaseOrders) ? purchaseOrders : []).slice(0, 5).forEach((order) => {
        const count = order.order_items?.length || 0;
        const fulfillment = order.fulfillment_status || "pending";
        if (order.status === "pending") {
          items.push({
            id: `order:${order.id}:pending`,
            title: "Compra en proceso",
            body: `Tu orden ${order.id.slice(0, 8).toUpperCase()} espera confirmación de pago.`,
            actionLabel: "Ver estado",
            action: "openPurchases",
          });
        } else if (fulfillment === "delivered") {
          items.push({
            id: `order:${order.id}:benefits`,
            title: "Entrega realizada",
            body: `Confirma recibido para reclamar puntos por ${count} producto(s).`,
            actionLabel: "Reclamar puntos",
            action: "openPurchases",
          });
        } else if (["paid", "preparing", "shipped"].includes(fulfillment) || order.status === "paid") {
          items.push({
            id: `order:${order.id}:${fulfillment}`,
            title: fulfillment === "shipped" ? "Envío en camino" : "Pago confirmado",
            body: `${count} producto(s) con trazabilidad disponible.`,
            actionLabel: "Ver trazabilidad",
            action: "openPurchases",
          });
        }
      });
    }

    return items.filter((item) => !dismissedNotificationIds.includes(item.id));
  }, [dismissedNotificationIds, fundMovements, products, profile, purchaseOrders, reservations, resources, salesOrders]);

  useEffect(() => {
    notificationItems.forEach((item) => {
      if (notificationTimersRef.current.has(item.id)) return;
      const timer = window.setTimeout(() => {
        dismissNotification(item.id);
        notificationTimersRef.current.delete(item.id);
      }, 30000);
      notificationTimersRef.current.set(item.id, timer);
    });
  }, [notificationItems]);

  useEffect(() => {
    if (notificationSeenRef.current.size === 0) {
      notificationItems.forEach((item) => notificationSeenRef.current.add(item.id));
      return;
    }
    const fresh = notificationItems.filter((item) => !notificationSeenRef.current.has(item.id));
    fresh.forEach((item) => notificationSeenRef.current.add(item.id));
    if (fresh.length > 0) setAuthMessage(fresh[0].title + ": " + fresh[0].body);
  }, [notificationItems]);

  function addToCart(product: Product) {
    if (!canShop) {
      setAuthMessage("Solo las cuentas de cliente pueden comprar productos.");
      return;
    }
    if (product.stock <= 0) {
      setAuthMessage("Este producto ya no tiene existencias disponibles.");
      return;
    }
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing && existing.quantity >= product.stock) {
      setAuthMessage(`Solo quedan ${product.stock} piezas disponibles de ${product.name}.`);
      return;
    }
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        return items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...items, { product, quantity: 1 }];
    });
    setAuthMessage(`${product.name} se agregó al carrito.`);
  }

  async function startCheckout() {
    try {
      if (!session) {
        setAuthMessage("Por favor, inicia sesión para poder realizar el pago con Stripe.");
        return;
      }
      if (!canShop) {
        setAuthMessage("Cambia tu perfil a Cliente si necesitas hacer una compra.");
        return;
      }
      if (!shippingForm.name || !shippingForm.phone || !shippingForm.address || !shippingForm.city || !shippingForm.state || !shippingForm.postalCode) {
        setAuthMessage("Completa tus datos de entrega antes de proceder al pago.");
        return;
      }
      if (saveDeliveryInfo) {
        localStorage.setItem(shippingStorageKey, JSON.stringify(shippingForm));
      } else {
        localStorage.removeItem(shippingStorageKey);
      }
      setAuthMessage("Creando sesión segura de pago en Stripe...");
      const response = await api<{ url: string }>("/api/checkout/session", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          shipping: shippingForm,
          returnOrigin: window.location.origin,
          redeemPoints: rewardDiscount,
        }),
      });
      window.location.href = response.url;
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo iniciar el pago con Stripe."));
    }
  }

  async function openTrace(product: Product) {
    setSelectedProduct(product);
    setQrDataUrl(null);
    const [stages, qr] = await Promise.all([
      api<TraceabilityStage[]>(`/api/products/${product.id}/traceability`),
      api<{ dataUrl: string }>(`/api/products/${product.id}/qr`),
    ]);
    setTraceStages(stages);
    setQrDataUrl(qr.dataUrl);
    const trace = await api<{ product: Product; stages: TraceabilityStage[]; anchors: BlockchainAnchor[] }>(
      `/api/traceability/code/${product.traceCode}`,
    );
    setAnchors(trace.anchors);
  }

  async function downloadProductQr(product: Product, orderId?: string) {
    const response = await fetch(`/api/products/${product.id}/qr.png`);
    if (!response.ok) {
      setAuthMessage("No se pudo generar el QR de trazabilidad.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = product.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    link.href = url;
    link.download = `qr-${safeName || "producto"}-${orderId ? orderId.slice(0, 8) : product.traceCode}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setAuthMessage("QR descargado como imagen PNG.");
  }

  async function downloadAuthenticatedPdf(path: string, filename: string, successMessage: string) {
    try {
      const response = await fetch(path, { headers: await authHeaders() });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        let detail = "";
        try {
          const body = contentType.includes("application/json") ? await response.json() : await response.text();
          detail = typeof body === "string" ? body : body.error || "";
        } catch {
          detail = "";
        }
        throw new Error(detail || ("No se pudo generar el reporte (" + response.status + ")."));
      }
      if (!contentType.includes("application/pdf")) {
        throw new Error("El servidor no devolvió un PDF válido.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setAuthMessage(successMessage);
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo generar el reporte."));
    }
  }

  async function downloadFundReport() {
    await downloadAuthenticatedPdf(
      "/api/reports/community-fund.pdf",
      "jnatjo-reporte-fondo-comunitario.pdf",
      "Reporte del fondo comunitario descargado correctamente.",
    );
  }

  async function downloadProducerReport() {
    await downloadAuthenticatedPdf(
      "/api/reports/producer.pdf",
      "jnatjo-reporte-productor.pdf",
      "Reporte del productor descargado correctamente.",
    );
  }

  async function downloadCoopReport() {
    await downloadAuthenticatedPdf(
      "/api/reports/cooperative.pdf",
      "jnatjo-reporte-cooperativa.pdf",
      "Reporte de cooperativa descargado correctamente.",
    );
  }

  async function downloadCustomerReport() {
    await downloadAuthenticatedPdf(
      "/api/reports/customer.pdf",
      "jnatjo-reporte-compras.pdf",
      "Reporte de compras descargado correctamente.",
    );
  }

  async function downloadInventoryReport() {
    await downloadAuthenticatedPdf(
      "/api/reports/inventory.pdf",
      "jnatjo-reporte-inventario.pdf",
      "Reporte de inventario descargado correctamente.",
    );
  }

  async function downloadAdminReport() {
    await downloadAuthenticatedPdf(
      "/api/reports/admin.pdf",
      "jnatjo-reporte-administrativo.pdf",
      "Reporte administrativo descargado correctamente.",
    );
  }

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    const materialsCost = (productForm.materialItems || []).reduce((sum: number, item: MaterialItem) => sum + Number(item.cost || 0), 0);
    const payload = {
      ...productForm,
      image: productForm.images[0] || productForm.image,
      materialsCost,
      platformCommission: Math.round(Number(productForm.price || 0) * 0.15),
      laborCost: Math.max(
        Number(productForm.price || 0) -
          materialsCost -
          Number(productForm.communityFund || 0) -
          Math.round(Number(productForm.price || 0) * 0.15),
        0,
      ),
      materials: (productForm.materialItems || []).map((item: MaterialItem) => item.name).filter(Boolean).join(", "),
    };
    await api<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthMessage("Producto registrado exitosamente. Si eres artesano, queda pendiente de validación comarcal.");
    await loadPublicData();
  }

  async function restockProduct(productId: string, amount: number) {
    try {
      await api<Product>(`/api/products/${productId}/stock`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      setAuthMessage("Existencias actualizadas.");
      await loadPublicData();
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo abastecer el producto."));
    }
  }

  async function handleNotificationClick(notification: NavNotification) {
    const item = notification as AppNotification;
    if (item.action === "restock" && item.productId) {
      await restockProduct(item.productId, 1);
      dismissNotification(item.id);
      return;
    }
    if (item.action === "openPurchases") {
      setTab("purchases");
      dismissNotification(item.id);
      return;
    }
    if (item.action === "openCooperative") {
      setTab("cooperative");
      dismissNotification(item.id);
      return;
    }
    if (item.action === "openProducer") {
      setTab("producer");
      dismissNotification(item.id);
      return;
    }
    if (item.action === "openInventory") {
      setTab("inventory");
      dismissNotification(item.id);
      return;
    }
    if (item.action === "openFund") {
      setTab("fund");
      dismissNotification(item.id);
    }
  }

  async function uploadProductImages(files: File[]) {
    if (files.length === 0) return;
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${activeUserKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      uploadedUrls.push(data.publicUrl);
    }
    setProductForm((prev: any) => {
      const images = Array.from(new Set([...(prev.images || []), ...uploadedUrls]));
      return { ...prev, images, image: images[0] || "" };
    });
    setAuthMessage(`${uploadedUrls.length} foto(s) subida(s) a Supabase Storage.`);
  }

  async function validateProduct(productId: string) {
    try {
      await api(`/api/products/${productId}/validate`, { method: "POST", body: JSON.stringify({}) });
      setAuthMessage("Origen y comercio justo validados correctamente.");
      await loadPublicData();
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo validar el origen del producto."));
    }
  }

  async function deleteAdminProduct(product: Product) {
    if (!window.confirm(`¿Eliminar "${product.name}"? Si ya tuvo ventas se archivará para conservar las órdenes.`)) return;
    try {
      const result = await api<{ archived?: boolean; deleted?: boolean }>(`/api/admin/products/${product.id}`, { method: "DELETE" });
      setAuthMessage(result.archived ? "Producto archivado porque ya tenía compras registradas." : "Producto eliminado.");
      await Promise.all([loadPublicData(), loadPrivateData()]);
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo borrar el producto."));
    }
  }

  async function deleteAdminProfile(targetProfile: Profile) {
    if (!window.confirm(`¿Eliminar la cuenta de ${targetProfile.full_name}? Esta acción borra el acceso del usuario.`)) return;
    try {
      await api(`/api/admin/profiles/${targetProfile.id}`, { method: "DELETE" });
      setAuthMessage("Cliente/productor eliminado.");
      await loadPrivateData();
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo borrar el cliente o productor."));
    }
  }

  async function deleteAdminCooperative(cooperative: Cooperative) {
    if (!window.confirm(`¿Eliminar la cooperativa "${cooperative.name}"?`)) return;
    try {
      await api(`/api/admin/cooperatives/${cooperative.id}`, { method: "DELETE" });
      setAuthMessage("Cooperativa eliminada.");
      await Promise.all([loadPublicData(), loadPrivateData()]);
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo borrar la cooperativa."));
    }
  }

  async function anchorProduct(productId: string) {
    if (!profile || !["producer", "cooperative", "admin"].includes(profile.role)) {
      setAuthMessage("Solo productores, cooperativas y administradores pueden anclar el historial blockchain.");
      return;
    }
    const anchor = await api<BlockchainAnchor>(`/api/blockchain/anchor/${productId}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setAuthMessage(`Historial anclado con éxito. Estado: ${anchor.status}${anchor.tx_hash ? ` (Tx: ${anchor.tx_hash})` : ""}.`);
    if (selectedProduct) await openTrace(selectedProduct);
  }

  function playNfcTone() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audio = new AudioCtx();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.16);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + 0.17);
    } catch {}
  }

  async function notifyNfcProduct(product: Product) {
    playNfcTone();
    if ("Notification" in window) {
      try {
        if (Notification.permission === "default") await Notification.requestPermission();
        if (Notification.permission === "granted") {
          new Notification("Jnanto Market", {
            body: `Producto detectado: ${product.name}. Abriendo trazabilidad…`,
            icon: product.images?.[0] || product.image || undefined,
            tag: `jnanto-nfc-${product.traceCode}`,
          });
        }
      } catch {}
    }
  }

  function decodeNfcRecord(record: any): string {
    try {
      if (typeof record?.data === "string") return record.data;
      if (!record?.data) return "";
      return new TextDecoder().decode(new Uint8Array(record.data.buffer || record.data));
    } catch { return ""; }
  }

  function extractNfcTraceCode(message: any): string | null {
    for (const record of message?.records || []) {
      const data = decodeNfcRecord(record);
      const urlMatch = data.match(/(?:trazabilidad|nfc)\/([^/?#\s]+)/i);
      if (urlMatch?.[1]) return decodeURIComponent(urlMatch[1]);
      const textMatch = data.match(/Trazabilidad\s+([^\s·]+)/i);
      if (textMatch?.[1]) return textMatch[1].trim();
    }
    return null;
  }

  async function startNfcReader() {
    const NDEFReader = (window as any).NDEFReader;
    if (!NDEFReader) {
      setAuthMessage("Este teléfono no permite leer NFC desde el navegador. Puedes usar la detección nativa de Android o instalar la PWA.");
      return;
    }

    try {
      window.localStorage.setItem("jnanto_nfc_enabled", "1");
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission().catch(() => undefined);
      }

      nfcReaderAbortRef.current?.abort();

      const controller = new AbortController();
      const reader = new NDEFReader();
      nfcReaderAbortRef.current = controller;
      nfcReaderRef.current = reader;

      const handleReading = (event: any) => {
        const traceCode = extractNfcTraceCode(event.message);
        if (!traceCode) {
          setAuthMessage("Etiqueta detectada, pero no contiene un código Jnanto válido.");
          return;
        }

        const now = Date.now();
        const last = nfcLastReadRef.current;
        if (last && last.code === traceCode && now - last.at < 1400) return;
        nfcLastReadRef.current = { code: traceCode, at: now };

        if (nfcReadBusyRef.current) return;
        nfcReadBusyRef.current = true;

        void (async () => {
          try {
            const result = await loadPublicTrace(traceCode);
            if (!result) throw new Error("Producto no encontrado");

            setNfcDetectedName(result.product.name);
            setNfcReaderState("detected");
            setShowNfcToast(true);

            // El lector permanece activo; no abortamos la sesión después de una lectura.
            // Así se pueden detectar varias etiquetas consecutivas en la misma visita.
          } catch (error) {
            setAuthMessage(error instanceof Error ? error.message : "No se pudo identificar el producto NFC.");
          } finally {
            nfcReadBusyRef.current = false;
            window.setTimeout(() => {
              if (nfcReaderRef.current === reader) setNfcReaderState("scanning");
            }, 700);
          }
        })();
      };

      reader.addEventListener("reading", handleReading, { signal: controller.signal });
      reader.addEventListener("readingerror", () => {
        // Un error momentáneo de lectura no desactiva el lector; el siguiente acercamiento puede leerse.
        if (nfcReaderRef.current === reader) {
          setAuthMessage("NFC activo. Mantén la etiqueta cerca del teléfono y vuelve a intentarlo.");
        }
      }, { signal: controller.signal });

      setNfcReaderState("scanning");
      setAuthMessage("NFC activo. Puedes acercar una etiqueta tras otra.");

      await reader.scan({ signal: controller.signal });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/abort/i.test(message)) {
        nfcReaderRef.current = null;
        nfcReaderAbortRef.current = null;
        setNfcReaderState("idle");
        setAuthMessage("No se pudo mantener activo el lector NFC. Pulsa reactivar NFC e inténtalo nuevamente.");
      }
    }
  }

  function stopNfcReader() {
    nfcReaderAbortRef.current?.abort();
    nfcReaderAbortRef.current = null;
    nfcReaderRef.current = null;
    setNfcReaderState("idle");
    nfcReadBusyRef.current = false;
  }


  async function writeNfc(product: Product) {
    if (!profile || !["producer", "cooperative", "admin"].includes(profile.role)) {
      setAuthMessage("Solo productores, cooperativas y administradores pueden escribir etiquetas NFC.");
      return;
    }

    const url = `${window.location.origin}/trazabilidad/${encodeURIComponent(product.traceCode)}?nfc=1`;
    const NDEFReader = (window as any).NDEFReader;

    if (!NDEFReader) {
      setAuthMessage("Este dispositivo no permite escribir NFC desde el navegador. Usa Chrome en Android o el código QR.");
      return;
    }

    if (nfcWriteTimerRef.current) {
      window.clearInterval(nfcWriteTimerRef.current);
      nfcWriteTimerRef.current = null;
    }

    setNfcWriteState("waiting");
    setNfcWriteProgress(12);

    try {
      const writer = new NDEFReader();

      // Estimación visual basada en una escritura NFC típica de pocos registros:
      // el círculo llega aproximadamente al 92% en ~3 segundos y espera la
      // confirmación real de writer.write() para completar el 100%.
      nfcWriteTimerRef.current = window.setInterval(() => {
        setNfcWriteProgress((current) => Math.min(current + 3.5, 92));
      }, 120);

      setAuthMessage("Acerca la etiqueta NFC al teléfono y no la retires hasta que el teléfono confirme la escritura.");

      await writer.write({
        records: [
          { recordType: "url", data: url },
          {
            recordType: "text",
            data: `Jnanto Market · ${product.name} · Trazabilidad ${product.traceCode}`,
            lang: "es",
          },
        ],
      });

      if (nfcWriteTimerRef.current) {
        window.clearInterval(nfcWriteTimerRef.current);
        nfcWriteTimerRef.current = null;
      }

      setNfcWriteProgress(100);
      setNfcWriteState("success");
      setAuthMessage("Etiqueta NFC programada correctamente. Ya puedes retirarla.");

      window.setTimeout(() => {
        setNfcWriteState("idle");
        setNfcWriteProgress(0);
      }, 1800);
    } catch (error) {
      if (nfcWriteTimerRef.current) {
        window.clearInterval(nfcWriteTimerRef.current);
        nfcWriteTimerRef.current = null;
      }

      const message = error instanceof Error ? error.message : "";
      setNfcWriteState("error");
      setNfcWriteProgress(0);

      if (/cancel|abort/i.test(message)) {
        setAuthMessage("Escritura NFC cancelada.");
      } else if (/network|removed|notreadable/i.test(message)) {
        setAuthMessage("La etiqueta se retiró antes de completar la escritura. Vuelve a acercarla y espera la confirmación.");
      } else {
        setAuthMessage("No se pudo grabar la etiqueta NFC. Mantén el teléfono cerca de la etiqueta e inténtalo nuevamente.");
      }

      window.setTimeout(() => setNfcWriteState("idle"), 2200);
    }
  }

  async function reserveResource(event: FormEvent) {
    event.preventDefault();
    if (!reservationForm.resourceId || !reservationForm.quantity || !reservationForm.startDate || !reservationForm.endDate || !reservationForm.notes) {
      setAuthMessage("Completa recurso, cantidad, inicio, fin y notas para solicitar el préstamo.");
      return;
    }
    try {
      await runLockedAction("reserve-resource", async () => {
        await api("/api/resources/reservations", {
          method: "POST",
          body: JSON.stringify(reservationForm),
        });
        setAuthMessage("Solicitud de reserva de maquinaria registrada.");
        setReservationForm({ resourceId: resources[0]?.id || "", quantity: 1, startDate: "", endDate: "", notes: "" });
        await Promise.all([loadPublicData(), loadPrivateData()]);
      });
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo registrar la reserva."));
    }
  }

  async function updateReservation(id: string, status: "approved" | "completed" | "cancelled") {
    try {
      await runLockedAction(`reservation-status:${id}`, async () => {
        await api(`/api/resources/reservations/${id}/status`, {
          method: "POST",
          body: JSON.stringify({ status }),
        });
        setAuthMessage(`Estado del préstamo actualizado a ${status}.`);
        await Promise.all([loadPublicData(), loadPrivateData()]);
      });
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo actualizar la reservación."));
    }
  }

  async function updateOrderFulfillment(orderId: string, status: "preparing" | "shipped" | "delivered" | "cancelled") {
    try {
      await runLockedAction(`order-fulfillment:${orderId}`, async () => {
        await api(`/api/orders/${orderId}/fulfillment`, {
          method: "POST",
          body: JSON.stringify({ status }),
        });
        setAuthMessage(`Estado de entrega actualizado a ${status}.`);
        await loadPrivateData();
      });
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo actualizar el estado de entrega."));
    }
  }

  async function createResource(event: FormEvent) {
    event.preventDefault();
    if (!resourceForm.name || !resourceForm.description || !resourceForm.quantity || !resourceForm.unit) {
      setAuthMessage("Completa nombre, descripción, cantidad y unidad para registrar el recurso.");
      return;
    }
    try {
      await api("/api/resources", {
        method: "POST",
        body: JSON.stringify({ ...resourceForm, cooperativeId: profile?.cooperative_id || "coop-1" }),
      });
      setAuthMessage("Recurso registrado exitosamente y agregado a la bitácora de inventario.");
      setResourceForm({ name: "", type: "insumo", description: "", quantity: "", unit: "", rentalCost: "" });
      await Promise.all([loadPublicData(), loadPrivateData()]);
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo registrar el recurso."));
    }
  }

  async function registerMovement(resourceId: string, type: "in" | "out", quantity: number, notes: string) {
    try {
      await api(`/api/resources/${resourceId}/movement`, {
        method: "POST",
        body: JSON.stringify({ type, quantity, notes }),
      });
      setAuthMessage("Ajuste de inventario registrado con éxito.");
      await Promise.all([loadPublicData(), loadPrivateData()]);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Error al ajustar el inventario.");
    }
  }

  async function addFundExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.get("description") || !form.get("amount")) {
      setAuthMessage("Completa descripción y monto para registrar el gasto.");
      return;
    }
    try {
      await runLockedAction("fund-expense", async () => {
        await api("/api/community-fund/expense", {
          method: "POST",
          body: JSON.stringify({
            description: form.get("description"),
            amount: form.get("amount"),
          }),
        });
        event.currentTarget.reset();
        setAuthMessage("Gasto registrado. Quedó pendiente de confirmación para descontarse del fondo comunal.");
        await Promise.all([loadPublicData(), loadPrivateData()]);
      });
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo registrar el gasto."));
    }
  }

  async function confirmFundExpense(movementId: string) {
    try {
      await api(`/api/community-fund/movements/${movementId}/confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setAuthMessage("Gasto confirmado correctamente.");
      await Promise.all([loadPublicData(), loadPrivateData()]);
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo confirmar el gasto."));
    }
  }

  async function addSensorReading(event: FormEvent) {
    event.preventDefault();
    if (!sensorForm.productId || !sensorForm.value || !sensorForm.unit || !sensorForm.location) {
      setAuthMessage("Completa producto, valor, unidad y ubicación para registrar telemetría.");
      return;
    }
    try {
      await runLockedAction("sensor-reading", async () => {
        await api("/api/sensors", {
          method: "POST",
          body: JSON.stringify(sensorForm),
        });
        setAuthMessage("Telemetría de sensor IoT registrada con éxito.");
        await Promise.all([loadPublicData(), loadPrivateData()]);
      });
    } catch (error) {
      setAuthMessage(getFriendlyError(error, "No se pudo registrar la telemetría."));
    }
  }

  if (publicTraceCode) {
    return (
      <>
        <PublicTracePage
          traceCode={publicTraceCode}
          data={publicTrace}
          message={authMessage}
          profile={profile}
          onBack={() => {
            stopNfcReader();
            window.history.pushState({}, "", "/");
            setPublicTrace(null);
            setShowNfcOpenCard(false);
            setShowNfcToast(false);
            setNfcDetectedName("");
            setRouteTick((value) => value + 1);
          }}
          onConfirmReceipt={confirmReceiptFromTrace}
        />
        {publicTrace && showNfcOpenCard && (
          <NfcOpenCard
            product={publicTrace.product}
            onOpen={() => { setShowNfcToast(false); setShowNfcOpenCard(false); window.history.pushState({}, "", `/trazabilidad/${encodeURIComponent(publicTrace.product.traceCode)}?nfc=1`); setRouteTick((value) => value + 1); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#004d32] text-[#101815]">
      {confirmingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 text-center border border-[#E6E2DA] shadow-xl animate-scale-in">
            <RefreshCw className="mx-auto mb-4 h-12 w-12 animate-spin text-[#5A6A42]" />
            <h3 className="text-xl font-serif font-bold text-[#2D2D2A]">Verificando Transacción</h3>
            <p className="text-sm text-[#6B665F] mt-2">
              Validando el estado de tu pago en Stripe y registrando la trazabilidad...
            </p>
          </div>
        </div>
      )}

      <Navbar
        currentTab={tab}
        onTabChange={setTab}
        visibleTabs={visibleTabs}
        search={search}
        setSearch={setSearch}
        cartCount={cartCount}
        showCart={canShop}
        showNotifications={Boolean(profile)}
        notifications={notificationItems}
        onNotificationClick={handleNotificationClick}
      />

      {installPrompt && (
        <div className="fixed bottom-20 left-1/2 z-[61] w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-2xl bg-white p-4 shadow-[0_16px_45px_rgba(0,0,0,0.2)] ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ed] text-[#004d32]"><Smartphone className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#101815]">Instalar Jñatjo Market</p>
              <p className="text-xs leading-relaxed text-[#69736d]">Ábrelo como app para mantener el lector NFC más estable mientras usas el sitio.</p>
            </div>
            <button type="button" onClick={async () => { const prompt = installPrompt; setInstallPrompt(null); if (prompt) { await prompt.prompt(); await prompt.userChoice; } }} className="shrink-0 rounded-xl bg-[#004d32] px-3 py-2.5 text-xs font-black text-white">Instalar</button>
          </div>
        </div>
      )}

      {nfcReaderState === "prompt" && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-[#101815]/45 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf3ed] text-[#004d32]"><Smartphone className="h-7 w-7" /></div>
            <h3 className="text-xl font-black text-[#101815]">Activar lector NFC</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#69736d]">Acepta una vez para que Jnanto pueda detectar etiquetas NFC mientras estás en el sitio. Después solo acerca la etiqueta.</p>
            <div className="mt-4 rounded-2xl bg-[#f6f8f6] p-3 text-xs text-[#69736d]"><div className="flex items-center gap-2 font-bold text-[#004d32]"><Bell className="h-4 w-4" /> Detección y aviso de producto</div><p className="mt-1">Se intentará activar también la notificación del sistema y un sonido corto.</p></div>
            <button type="button" onClick={async () => { window.localStorage.setItem("jnanto_nfc_enabled", "1"); await startNfcReader(); }} className="mt-5 w-full rounded-2xl bg-[#004d32] px-5 py-4 text-sm font-black text-white">Aceptar y activar NFC</button>
            <button type="button" onClick={() => setNfcReaderState("idle")} className="mt-2 w-full rounded-2xl px-5 py-3 text-sm font-bold text-[#69736d]">Ahora no</button>
          </div>
        </div>
      )}

      {showNfcToast && publicTrace?.product && (
        <div className="fixed left-1/2 top-4 z-[80] w-[calc(100%-24px)] max-w-md -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-[0_18px_50px_rgba(16,24,21,0.22)]">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#f1eee8]">
              {(publicTrace.product.images?.[0] || publicTrace.product.image) && <img src={publicTrace.product.images?.[0] || publicTrace.product.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#004d32]">Etiqueta NFC detectada</p>
              <p className="truncate text-sm font-black text-[#101815]">{nfcDetectedName}</p>
              <p className="text-[11px] text-[#69736d]">Toca para abrir el producto</p>
            </div>
            <button type="button" onClick={() => { setShowNfcToast(false); setShowNfcOpenCard(true); }} className="shrink-0 rounded-xl bg-[#004d32] px-4 py-3 text-sm font-black text-white">Abrir</button>
          </div>
        </div>
      )}

      {nfcReaderState === "scanning" && (
        <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-2xl bg-white p-4 shadow-[0_16px_45px_rgba(0,0,0,0.2)] ring-1 ring-black/5">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaf3ed] text-[#004d32]"><Fingerprint className="h-5 w-5 animate-pulse" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black text-[#101815]">NFC activo</p><p className="truncate text-xs text-[#69736d]">Acerca una etiqueta para detectar el producto</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => void startNfcReader()} className="text-xs font-bold text-[#004d32]">Reactivar</button><button type="button" onClick={stopNfcReader} className="text-xs font-bold text-[#69736d]">Cerrar</button></div></div>
        </div>
      )}

      {nfcReaderState === "detected" && (
        <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-2xl bg-[#004d32] p-4 text-white shadow-[0_16px_45px_rgba(0,77,50,0.3)]"><p className="text-xs font-bold uppercase tracking-widest opacity-75">NFC detectado</p><p className="mt-1 text-sm font-black">{nfcDetectedName || "Producto identificado"}</p></div>
      )}

      {nfcWriteState !== "idle" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="mx-auto flex h-28 w-28 items-center justify-center">
              <div
                className="relative flex h-28 w-28 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#004d32 ${nfcWriteProgress}%, #e8ece9 ${nfcWriteProgress}% 100%)`,
                }}
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white">
                  {nfcWriteState === "success" ? (
                    <CheckCircle2 className="h-10 w-10 text-[#004d32]" />
                  ) : nfcWriteState === "error" ? (
                    <AlertCircle className="h-10 w-10 text-red-500" />
                  ) : (
                    <Fingerprint className="h-9 w-9 text-[#004d32]" />
                  )}
                </div>
              </div>
            </div>
            <h3 className="mt-5 text-xl font-black text-[#101815]">
              {nfcWriteState === "waiting" ? "Programando etiqueta NFC" : nfcWriteState === "success" ? "Etiqueta programada" : "Escritura no completada"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#69736d]">
              {nfcWriteState === "waiting"
                ? "Mantén la etiqueta junto al teléfono. No la retires hasta que aparezca la confirmación."
                : nfcWriteState === "success"
                  ? "La etiqueta recibió la URL y los datos de identificación del producto."
                  : "Acerca nuevamente la etiqueta y espera la confirmación del teléfono."}
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e8ece9]">
              <div className="h-full rounded-full bg-[#004d32] transition-all duration-200" style={{ width: `${nfcWriteProgress}%` }} />
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-[#8a938d]">
              {nfcWriteState === "waiting" ? `${nfcWriteProgress}% · Esperando confirmación` : nfcWriteState === "success" ? "100% · Confirmado" : "Reintenta la escritura"}
            </p>
          </div>
        </div>
      )}

      {authMessage && (
        <div className="fixed right-4 top-32 z-40 max-w-sm rounded-xl border border-[#004d32]/20 bg-white px-4 py-3 text-sm font-semibold text-[#004d32] shadow-[0_18px_45px_rgba(0,0,0,0.16)] animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <span>{authMessage}</span>
            <button
              type="button"
              onClick={() => setAuthMessage(null)}
              className="shrink-0 text-[#004d32]/60 transition hover:text-[#004d32]"
              aria-label="Cerrar mensaje"
            >
              x
            </button>
          </div>
        </div>
      )}

      <main
        className={`mx-auto my-0 bg-white px-4 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.18)] sm:my-8 sm:px-8 xl:px-10 ${
          tab === "account" || tab === "cart" ? "max-w-[760px]" : "max-w-[1320px]"
        }`}
      >
        <section className="space-y-6 animate-slide-up" key={tab}>
          {tab === "marketplace" && (
            <MarketplaceView
              loading={loading}
              products={filteredProducts}
              category={category}
              search={search}
              filters={marketplaceFilters}
              setCategory={setCategory}
              setSearch={setSearch}
              setFilters={setMarketplaceFilters}
              onSelect={openTrace}
              onAdd={addToCart}
            />
          )}

          {tab === "account" && (
            <div className="mx-auto max-w-xl space-y-5">
              <div>
                <h2 className="text-3xl font-black text-[#101815]">Cuenta</h2>
                <p className="mt-2 text-sm font-medium text-[#69736d]">
                  Gestiona tu acceso y tu perfil operativo sin mezclarlo con la tienda.
                </p>
              </div>
              <AuthPanel
                session={session}
                profile={profile}
                authMode={authMode}
                authForm={authForm}
                setAuthMode={changeAuthMode}
                setAuthForm={setAuthForm}
                onSubmit={handleAuth}
                onSignOut={signOut}
                onProfileUpdate={updateProfileSettings}
                cooperatives={cooperatives}
              />
            </div>
          )}

          {tab === "cart" && (
            <div className="mx-auto max-w-xl space-y-5">
              <div>
                <h2 className="text-3xl font-black text-[#101815]">Carrito</h2>
                <p className="mt-2 text-sm font-medium text-[#69736d]">
                  Revisa tus piezas, datos de entrega y pago en una vista dedicada.
                </p>
              </div>
              {canShop ? (
                <CartPanel
                  cart={cart}
                  setCart={setCart}
                  total={cartTotal}
                  shippingForm={shippingForm}
                  setShippingForm={setShippingForm}
                  saveDeliveryInfo={saveDeliveryInfo}
                  setSaveDeliveryInfo={setSaveDeliveryInfo}
                  rewardBalance={rewardBalance.availablePoints}
                  rewardDiscount={rewardDiscount}
                  useRewardPoints={useRewardPoints}
                  setUseRewardPoints={setUseRewardPoints}
                  onCheckout={startCheckout}
                />
              ) : (
                <div className="rounded-2xl border border-black/10 bg-[#f8f8f4] p-6 text-sm font-semibold text-[#69736d]">
                  Cambia tu perfil a Cliente para poder usar el carrito.
                </div>
              )}
            </div>
          )}

          {tab === "purchases" && (
            <PurchasesView
              profile={profile}
              orders={purchaseOrders}
              products={products}
              onTrace={openTrace}
              onDownloadReport={downloadCustomerReport}
            />
          )}

          {tab === "producer" && (
            <ProducerView
              profile={profile}
              products={products}
              salesOrders={salesOrders}
              producers={producers}
              productForm={productForm}
              setProductForm={setProductForm}
              onCreate={createProduct}
              onTrace={openTrace}
              onRestock={restockProduct}
              onImageUpload={uploadProductImages}
              onDownloadQr={downloadProductQr}
              onDownloadReport={downloadProducerReport}
              settlementSummary={producerSettlement}
              settlementPeriod={settlementPeriod}
              setSettlementPeriod={setSettlementPeriod}
              onReloadSettlements={reloadSettlements}
            />
          )}

          {tab === "cooperative" && (
            <CooperativeView
              profile={profile}
              products={products}
              reservations={reservations}
              onValidate={validateProduct}
              onReservation={updateReservation}
              onFulfillment={updateOrderFulfillment}
              orders={orders}
              onTrace={openTrace}
              onDownloadQr={downloadProductQr}
              onDownloadReport={downloadCoopReport}
              settlementSummary={cooperativeSettlement}
              settlementPeriod={settlementPeriod}
              setSettlementPeriod={setSettlementPeriod}
              onReloadSettlements={reloadSettlements}
              onCreateSettlement={createProducerSettlement}
              onPaySettlement={payProducerSettlement}
            />
          )}

          {tab === "inventory" && (
            <InventoryView
              resources={resources}
              reservations={reservations}
              movements={movements}
              profile={profile}
              reservationForm={reservationForm}
              setReservationForm={setReservationForm}
              resourceForm={resourceForm}
              setResourceForm={setResourceForm}
              onReserve={reserveResource}
              onCreateResource={createResource}
              onRegisterMovement={registerMovement}
              onDownloadReport={downloadInventoryReport}
            />
          )}

          {tab === "fund" && (
            <FundView
              balance={fundBalance}
              movements={fundMovements}
              canManage={Boolean(profile && ["admin", "cooperative", "inventory_manager"].includes(profile.role))}
              onExpense={addFundExpense}
              onConfirmExpense={confirmFundExpense}
              onDownloadReport={downloadFundReport}
            />
          )}

          {tab === "admin" && (
            <AdminView
              profile={profile}
              orders={orders}
              products={products}
              cooperatives={cooperatives}
              profiles={adminProfiles}
              sensorForm={sensorForm}
              setSensorForm={setSensorForm}
              onSensor={addSensorReading}
              onAnchor={anchorProduct}
              onDeleteProduct={deleteAdminProduct}
              onDeleteProfile={deleteAdminProfile}
              onDeleteCooperative={deleteAdminCooperative}
              onDownloadReport={downloadAdminReport}
            />
          )}
        </section>
      </main>

      {selectedProduct && (
        <TraceModal
          product={selectedProduct}
          stages={traceStages}
          anchors={anchors}
          qrDataUrl={qrDataUrl}
          onClose={() => setSelectedProduct(null)}
          onNfc={() => writeNfc(selectedProduct)}
          onAnchor={() => anchorProduct(selectedProduct.id)}
          canManageTraceability={Boolean(profile && ["producer", "cooperative", "admin"].includes(profile.role))}
        />
      )}
    </div>
  );
}
