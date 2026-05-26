import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
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
} from "./types";

// Components
import Navbar, { NavNotification } from "./components/Navbar";
import AuthPanel from "./components/AuthPanel";
import CartPanel from "./components/CartPanel";
import TraceModal from "./components/TraceModal";

// Views
import MarketplaceView from "./views/MarketplaceView";
import PurchasesView from "./views/PurchasesView";
import ProducerView from "./views/ProducerView";
import CooperativeView from "./views/CooperativeView";
import InventoryView from "./views/InventoryView";
import FundView from "./views/FundView";
import AdminView from "./views/AdminView";
import PublicTracePage from "./views/PublicTracePage";

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
  action: "restock" | "openPurchases" | "openCooperative" | "openProducer";
  productId?: string;
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
  const [resources, setResources] = useState<CommunityResource[]>([]);
  const [reservations, setReservations] = useState<ResourceReservation[]>([]);
  const [fundMovements, setFundMovements] = useState<CommunityFundMovement[]>([]);
  const [fundBalance, setFundBalance] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<Order[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
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
  const [publicTrace, setPublicTrace] = useState<{
    product: Product;
    stages: TraceabilityStage[];
    anchors: BlockchainAnchor[];
  } | null>(null);

  const [productForm, setProductForm] = useState({
    name: "Blusa bordada mazahua",
    description: "Pieza de manta bordada a mano con desglose transparente de comercio justo.",
    category: "Textiles bordados",
    price: 850,
    materials: "Manta, hilo de algodon",
    materialItems: [
      { name: "Manta", cost: 80 },
      { name: "Hilo de algodon", cost: 40 },
    ] as MaterialItem[],
    materialsCost: 120,
    laborCost: 560,
    communityFund: 85,
    platformCommission: 128,
    craftHours: 40,
    producerId: "prod-1",
    stock: 3,
    image: "",
    images: [] as string[],
  });

  const [resourceForm, setResourceForm] = useState({
    name: "Hilo rojo",
    type: "insumo" as "insumo" | "maquinaria",
    description: "Lote comunitario para bordado tradicional.",
    quantity: 120,
    unit: "piezas",
    rentalCost: 0,
  });

  const [reservationForm, setReservationForm] = useState({
    resourceId: "",
    startDate: "2026-05-28T10:00",
    endDate: "2026-05-28T13:00",
    notes: "Uso para produccion artesanal.",
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
  const [cartHydrated, setCartHydrated] = useState(false);
  const activeUserKey = session?.user.id || "guest";
  const cartStorageKey = `jnatjo-cart:${activeUserKey}`;
  const shippingStorageKey = `jnatjo-shipping:${activeUserKey}`;
  const notificationStorageKey = `jnatjo-notifications:${activeUserKey}`;
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);

  const [sensorForm, setSensorForm] = useState({
    productId: "",
    sensorType: "temperature",
    value: 22,
    unit: "C",
    location: "Bodega comunitaria",
  });

  const publicTraceCode = useMemo(() => {
    const match = window.location.pathname.match(/^\/trazabilidad\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
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

  async function loadPublicData() {
    setLoading(true);
    try {
      const [productRows, coopRows, producerRows, resourceRows, fund] = await Promise.all([
        api<Product[]>("/api/products?includePending=true"),
        api<Cooperative[]>("/api/cooperatives"),
        api<Producer[]>("/api/producers"),
        api<CommunityResource[]>("/api/resources"),
        api<{ balance: number; movements: CommunityFundMovement[] }>("/api/community-fund"),
      ]);
      setProducts(productRows);
      setCooperatives(coopRows);
      setProducers(producerRows);
      setResources(resourceRows);
      setFundBalance(fund.balance);
      setFundMovements(fund.movements);
      if (!reservationForm.resourceId && resourceRows[0]) {
        setReservationForm((prev) => ({ ...prev, resourceId: resourceRows[0].id }));
      }
      if (!sensorForm.productId && productRows[0]) {
        setSensorForm((prev) => ({ ...prev, productId: productRows[0].id }));
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadPrivateData() {
    if (!session) return;
    try {
      const [profileRow, reservationRows, purchaseRows, salesRows, adminOrderRows, movementRows] = await Promise.all([
        api<Profile>("/api/auth/profile"),
        api<ResourceReservation[]>("/api/resources/reservations"),
        api<Order[]>("/api/orders?scope=purchases"),
        api<Order[]>("/api/orders?scope=sales"),
        api<Order[]>("/api/orders?scope=operations"),
        api<any[]>("/api/resources/movements"),
      ]);
      setProfile(profileRow);
      setReservations(reservationRows);
      setPurchaseOrders(purchaseRows);
      setSalesOrders(salesRows);
      setOrders(adminOrderRows);
      setMovements(movementRows);
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadPublicTrace(traceCode: string) {
    const data = await api<{ product: Product; stages: TraceabilityStage[]; anchors: BlockchainAnchor[] }>(
      `/api/traceability/code/${encodeURIComponent(traceCode)}`,
    );
    setPublicTrace(data);
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
    } else if (checkoutParams.checkout === "cancelled") {
      checkoutHandledRef.current = true;
      setAuthMessage("El pago fue cancelado. Puedes seguir explorando y comprar cuando gustes.");
      window.history.pushState({}, "", "/");
    }
  }, [authReady, checkoutParams, session]);

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
      loadPublicTrace(publicTraceCode).catch((error) => setAuthMessage(error.message));
    } else {
      loadPublicData().catch((error) => setAuthMessage(error.message));
    }
  }, [publicTraceCode]);

  useEffect(() => {
    loadPrivateData();
  }, [session]);

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
    try {
      const saved = localStorage.getItem(notificationStorageKey);
      setDismissedNotificationIds(saved ? JSON.parse(saved) : []);
    } catch {
      setDismissedNotificationIds([]);
    }
  }, [notificationStorageKey]);

  function dismissNotification(id: string) {
    setDismissedNotificationIds((current) => {
      const next = Array.from(new Set([...current, id]));
      localStorage.setItem(notificationStorageKey, JSON.stringify(next));
      return next;
    });
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
    setTab("marketplace");
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const normalizedCategory = normalizeText(category);
    const normalizedMaterial = normalizeText(marketplaceFilters.material);
    const maxPrice = marketplaceFilters.maxPrice === "all" ? Infinity : Number(marketplaceFilters.maxPrice);
    const minProducerShare =
      marketplaceFilters.minProducerShare === "all" ? 0 : Number(marketplaceFilters.minProducerShare);

    const rows = products.filter((product) => {
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
  const canShop = !profile || profile.role === "customer";
  const notificationItems = useMemo<AppNotification[]>(() => {
    if (!profile) return [];
    const items: AppNotification[] = [];
    const ownProducts = profile.role === "producer"
      ? products.filter((product) => product.producerId === profile.id || product.producerName === profile.full_name)
      : products;

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

    if (["cooperative", "verifier", "admin"].includes(profile.role)) {
      products
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
      purchaseOrders.slice(0, 5).forEach((order) => {
        const count = order.order_items?.length || 0;
        if (order.status === "pending") {
          items.push({
            id: `order:${order.id}:pending`,
            title: "Compra en proceso",
            body: `Tu orden ${order.id.slice(0, 8).toUpperCase()} espera confirmación de pago.`,
            actionLabel: "Ver estado",
            action: "openPurchases",
          });
        } else if (["paid", "shipped"].includes(order.status)) {
          items.push({
            id: `order:${order.id}:${order.status}`,
            title: order.status === "paid" ? "Pago confirmado" : "Envío en camino",
            body: `${count} producto(s) con trazabilidad y beneficios disponibles.`,
            actionLabel: "Ver trazabilidad",
            action: "openPurchases",
          });
        } else if (order.status === "delivered") {
          items.push({
            id: `order:${order.id}:benefits`,
            title: "Beneficios disponibles",
            body: `Atiende tus puntos y revisa la trazabilidad de ${count} producto(s).`,
            actionLabel: "Atender beneficios",
            action: "openPurchases",
          });
        }
      });
    }

    return items.filter((item) => !dismissedNotificationIds.includes(item.id));
  }, [dismissedNotificationIds, products, profile, purchaseOrders]);

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

  async function anchorProduct(productId: string) {
    const anchor = await api<BlockchainAnchor>(`/api/blockchain/anchor/${productId}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setAuthMessage(`Historial anclado con éxito. Estado: ${anchor.status}${anchor.tx_hash ? ` (Tx: ${anchor.tx_hash})` : ""}.`);
    if (selectedProduct) await openTrace(selectedProduct);
  }

  async function writeNfc(product: Product) {
    const url = `${window.location.origin}/trazabilidad/${encodeURIComponent(product.traceCode)}`;
    const NDEFReader = (window as any).NDEFReader;
    if (!NDEFReader) {
      setAuthMessage("Tu navegador o dispositivo móvil actual no soporta Web NFC. Utiliza el código QR impreso.");
      return;
    }
    const writer = new NDEFReader();
    await writer.write(url);
    setAuthMessage("Chip NFC grabado exitosamente con la dirección de trazabilidad.");
  }

  async function reserveResource(event: FormEvent) {
    event.preventDefault();
    await api("/api/resources/reservations", {
      method: "POST",
      body: JSON.stringify(reservationForm),
    });
    setAuthMessage("Solicitud de reserva de maquinaria registrada.");
    await loadPrivateData();
  }

  async function updateReservation(id: string, status: "approved" | "completed" | "cancelled") {
    await api(`/api/resources/reservations/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    await loadPrivateData();
  }

  async function updateOrderFulfillment(orderId: string, status: "preparing" | "shipped" | "delivered" | "cancelled") {
    await api(`/api/orders/${orderId}/fulfillment`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    await loadPrivateData();
  }

  async function createResource(event: FormEvent) {
    event.preventDefault();
    await api("/api/resources", {
      method: "POST",
      body: JSON.stringify({ ...resourceForm, cooperativeId: profile?.cooperative_id || "coop-1" }),
    });
    setAuthMessage("Recurso registrado exitosamente en el almacén.");
    await loadPublicData();
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
    await api("/api/community-fund/expense", {
      method: "POST",
      body: JSON.stringify({
        description: form.get("description"),
        amount: form.get("amount"),
      }),
    });
    event.currentTarget.reset();
    await loadPublicData();
  }

  async function addSensorReading(event: FormEvent) {
    event.preventDefault();
    await api("/api/sensors", {
      method: "POST",
      body: JSON.stringify(sensorForm),
    });
    setAuthMessage("Telemetría de sensor IoT registrada con éxito.");
  }

  if (publicTraceCode) {
    return (
      <PublicTracePage
        traceCode={publicTraceCode}
        data={publicTrace}
        message={authMessage}
        profile={profile}
        onBack={() => {
          window.history.pushState({}, "", "/");
          window.location.reload();
        }}
        onConfirmReceipt={confirmReceiptFromTrace}
      />
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
            />
          )}

          {tab === "fund" && (
            <FundView
              balance={fundBalance}
              movements={fundMovements}
              canManage={Boolean(profile && ["admin", "cooperative", "inventory_manager"].includes(profile.role))}
              onExpense={addFundExpense}
            />
          )}

          {tab === "admin" && (
            <AdminView
              profile={profile}
              orders={orders}
              products={products}
              sensorForm={sensorForm}
              setSensorForm={setSensorForm}
              onSensor={addSensorReading}
              onAnchor={anchorProduct}
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
        />
      )}
    </div>
  );
}
