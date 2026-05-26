import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import Stripe from "stripe";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import WebSocket from "ws";
import { createWalletClient, http } from "viem";
import { polygonAmoy } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config({ path: ".env.local" });
dotenv.config();

export const app = express();
const PROJECT_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;
const BLOCKCHAIN_PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;
const AMOY_CHAIN_ID = 80002;
const websocketTransport = WebSocket as unknown as typeof globalThis.WebSocket;

if (!PROJECT_URL || !SERVICE_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and configure Supabase.");
}

const supabase = createClient(PROJECT_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: websocketTransport,
  },
});

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

type ProfileRole =
  | "customer"
  | "producer"
  | "cooperative"
  | "verifier"
  | "inventory_manager"
  | "logistics"
  | "admin";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: ProfileRole;
  community: string | null;
  cooperative_id: string | null;
}

interface AuthedRequest extends Request {
  user?: User;
  profile?: Profile;
}

function sha256(value: unknown): string {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function money(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function traceUrl(traceCode: string): string {
  return `${APP_URL.replace(/\/$/, "")}/trazabilidad/${encodeURIComponent(traceCode)}`;
}

function traceUrlFromRequest(req: Request, traceCode: string): string {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  if (!host) return traceUrl(traceCode);
  return `${protocol}://${host}/trazabilidad/${encodeURIComponent(traceCode)}`;
}

async function getUserFromRequest(req: Request): Promise<User | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function profileFromUserMetadata(user: User): Profile {
  const metadata = user.user_metadata || {};
  const allowedRoles: ProfileRole[] = ["customer", "producer", "cooperative"];
  const metadataRole = typeof metadata.role === "string" ? metadata.role : "customer";
  const role = allowedRoles.includes(metadataRole as ProfileRole) ? (metadataRole as ProfileRole) : "customer";
  const fullName =
    assertString(metadata.full_name) ||
    assertString(metadata.fullName) ||
    assertString(user.email?.split("@")[0], "Cliente Jnatjo");

  return {
    id: user.id,
    full_name: fullName,
    email: user.email || "",
    role,
    community: assertString(metadata.community, "San Felipe del Progreso"),
    cooperative_id: role === "customer" ? null : assertString(metadata.cooperative_id, "coop-1"),
  };
}

async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function ensureProfile(user: User): Promise<Profile> {
  const existing = await getProfile(user.id);
  if (existing) return existing;

  const profile = profileFromUserMetadata(user);
  const { data, error } = await supabase.from("profiles").upsert(profile).select("*").single();
  if (error) throw error;
  return data as Profile;
}

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Necesitas iniciar sesion." });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Necesitas iniciar sesion." });
    const profile = await ensureProfile(user);
    req.user = user;
    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRoles(roles: ProfileRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.profile || !roles.includes(req.profile.role)) {
      return res.status(403).json({ error: "Tu rol no tiene permiso para esta accion." });
    }
    next();
  };
}

function requestOrigin(req: Request): string | null {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  return host ? `${protocol}://${host}` : null;
}

function safeReturnOrigin(value: unknown, req?: Request): string {
  const fallback = APP_URL.replace(/\/$/, "");
  if (typeof value !== "string") return fallback;
  try {
    const origin = new URL(value).origin;
    const fallbackOrigin = new URL(fallback).origin;
    const currentOrigin = req ? requestOrigin(req) : null;
    const parsed = new URL(origin);
    const isLocalNetwork =
      parsed.protocol === "http:" &&
      /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(parsed.hostname);
    const allowedLocalOrigins = new Set([
      fallbackOrigin,
      currentOrigin,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
    return allowedLocalOrigins.has(origin) || isLocalNetwork ? origin : fallback;
  } catch {
    return fallback;
  }
}

function normalizePersonName(value: unknown): string {
  return assertString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function insertTraceabilityStage(input: {
  productId: string;
  stageKey: string;
  stageLabel: string;
  description: string;
  responsible: string;
  payload?: Record<string, unknown>;
  userId?: string;
}) {
  const { data: previousRows, error: previousError } = await supabase
    .from("traceability_stages")
    .select("hash_actual")
    .eq("product_id", input.productId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (previousError) throw previousError;

  const hashPrevious =
    previousRows?.[0]?.hash_actual || "0000000000000000000000000000000000000000000000000000000000000000";
  const payload = input.payload || {};
  const hashActual = sha256({
    productId: input.productId,
    stageKey: input.stageKey,
    description: input.description,
    payload,
    hashPrevious,
    at: new Date().toISOString(),
  });

  const stage = {
    id: `${input.productId}-${input.stageKey}-${Date.now()}`,
    product_id: input.productId,
    stage_key: input.stageKey,
    stage_label: input.stageLabel,
    description: input.description,
    date: new Date().toISOString().slice(0, 10),
    responsible: input.responsible,
    hash_previous: hashPrevious,
    hash_actual: hashActual,
    payload,
    created_by: input.userId || null,
  };

  const { data, error } = await supabase.from("traceability_stages").insert(stage).select("*").single();
  if (error) throw error;
  return data;
}

async function grantReward(input: {
  customerId: string;
  orderId: string;
  productId: string;
  points: number;
  reason: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("customer_rewards").upsert(
    {
      customer_id: input.customerId,
      order_id: input.orderId,
      product_id: input.productId,
      points: input.points,
      reason: input.reason,
      payload: input.payload || {},
    },
    { onConflict: "customer_id,order_id,product_id,reason" },
  );
  if (error && error.code !== "42P01") throw error;
}

async function getRewardSummary(customerId: string) {
  let earned = 0;
  let redeemed = 0;

  const { data: rewards, error: rewardsError } = await supabase
    .from("customer_rewards")
    .select("points")
    .eq("customer_id", customerId);
  if (rewardsError && rewardsError.code !== "42P01") throw rewardsError;
  earned = (rewards || []).reduce((sum: number, row: any) => sum + Number(row.points || 0), 0);

  if (rewardsError?.code === "42P01" || earned === 0) {
    const { data: stages, error: stagesError } = await supabase
      .from("traceability_stages")
      .select("payload")
      .eq("stage_key", "received")
      .contains("payload", { customerId });
    if (stagesError) throw stagesError;
    earned = (stages || []).reduce((sum: number, stage: any) => sum + Number(stage.payload?.rewardPoints || 0), 0);
  }

  const { data: redemptions, error: redemptionsError } = await supabase
    .from("customer_reward_redemptions")
    .select("points")
    .eq("customer_id", customerId);
  if (redemptionsError && redemptionsError.code !== "42P01") throw redemptionsError;
  redeemed = (redemptions || []).reduce((sum: number, row: any) => sum + Number(row.points || 0), 0);

  return {
    earned,
    redeemed,
    available: Math.max(earned - redeemed, 0),
  };
}

async function redeemReward(input: {
  customerId: string;
  orderId: string;
  points: number;
  discountAmount: number;
}) {
  const { error } = await supabase.from("customer_reward_redemptions").insert({
    customer_id: input.customerId,
    order_id: input.orderId,
    points: input.points,
    discount_amount: input.discountAmount,
  });
  if (error?.code === "42P01") {
    throw new Error("Falta crear la tabla customer_reward_redemptions en Supabase para usar puntos como descuento.");
  }
  if (error) throw error;
}

function publicTraceStage(stage: any) {
  if (!stage) return stage;
  const payload = stage.payload || {};
  const publicPayload =
    stage.stage_key === "received"
      ? {
          producerRating: payload.producerRating,
          deliveryRating: payload.deliveryRating,
          comments: payload.comments,
          rewardPoints: payload.rewardPoints,
        }
      : {};

  if (stage.stage_key === "received") {
    return {
      ...stage,
      description: "El cliente verificó la entrega de esta pieza única y registró su experiencia.",
      responsible: "Cliente verificado",
      payload: publicPayload,
      created_by: null,
    };
  }

  if (stage.stage_key === "sold") {
    return {
      ...stage,
      payload: {},
      created_by: null,
    };
  }

  return {
    ...stage,
    payload: publicPayload,
    created_by: null,
  };
}

function scopedTraceStages(stages: any[]) {
  const latestSaleIndex = stages.map((stage) => stage.stage_key).lastIndexOf("sold");
  const latestReceiptIndex = stages.map((stage) => stage.stage_key).lastIndexOf("received");
  return stages.filter((stage, index) => {
    if (stage.stage_key === "sold") return index === latestSaleIndex;
    if (stage.stage_key === "received") return index === latestReceiptIndex;
    return true;
  });
}

function mapProduct(row: any) {
  const breakdown = row.breakdown || {
    materialsCost: money(row.materials_cost),
    laborCost: money(row.labor_cost),
    communityFund: money(row.community_fund),
    platformCommission: money(row.platform_commission),
  };
  const materialItems = Array.isArray(row.breakdown?.materialItems)
    ? row.breakdown.materialItems
    : Array.isArray(row.breakdown?.materials)
      ? row.breakdown.materials
      : [];
  const imageRows = Array.isArray(row.product_images) ? row.product_images : [];
  const images = [
    ...imageRows
      .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((item: any) => assertString(item.url))
      .filter(Boolean),
  ];
  if (row.image && !images.includes(row.image)) images.unshift(row.image);

  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category,
    price: money(row.price),
    materials: Array.isArray(row.materials) ? row.materials : String(row.materials || "").split(",").map((item) => item.trim()).filter(Boolean),
    craftHours: money(row.craft_hours),
    producerId: row.producer_id,
    producerName: row.producer_name,
    community: row.community,
    cooperativeId: row.cooperative_id,
    cooperativeName: row.cooperative_name,
    image: row.image || images[0] || "",
    images,
    stock: Number(row.stock || 0),
    status: row.status,
    traceCode: row.trace_code,
    breakdown: { ...breakdown, materialItems },
    fairTradeBadges: Array.isArray(row.fair_trade_badges) ? row.fair_trade_badges : [],
    rating: typeof row.rating === "number" ? row.rating : undefined,
    reviewCount: typeof row.review_count === "number" ? row.review_count : undefined,
    qrPayload: row.qr_payload,
    nfcPayload: row.nfc_payload,
  };
}

async function attachProductReviews<T extends any>(rows: T[]): Promise<T[]> {
  const productIds = rows.map((row: any) => row.id).filter(Boolean);
  if (productIds.length === 0) return rows;

  const { data, error } = await supabase
    .from("traceability_stages")
    .select("product_id, payload")
    .eq("stage_key", "received")
    .in("product_id", productIds);
  if (error) throw error;

  const stats = new Map<string, { sum: number; count: number }>();
  for (const stage of data || []) {
    const producerRating = Number(stage.payload?.producerRating || 0);
    const deliveryRating = Number(stage.payload?.deliveryRating || 0);
    const values = [producerRating, deliveryRating].filter((value) => value > 0);
    if (values.length === 0) continue;
    const rating = values.reduce((sum, value) => sum + value, 0) / values.length;
    const current = stats.get(stage.product_id) || { sum: 0, count: 0 };
    current.sum += rating;
    current.count += 1;
    stats.set(stage.product_id, current);
  }

  return rows.map((row: any) => {
    const stat = stats.get(row.id);
    if (!stat || stat.count === 0) return { ...row, rating: 0, review_count: 0 };
    return {
      ...row,
      rating: Math.round((stat.sum / stat.count) * 10) / 10,
      review_count: stat.count,
    };
  });
}

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Stripe webhook is not configured." });

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing Stripe signature." });

    const event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const { data: order } = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).maybeSingle();
        if (order && order.status !== "paid") {
          await supabase
            .from("orders")
            .update({
              status: "paid",
              fulfillment_status: "preparing",
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
            })
            .eq("id", orderId);

          await supabase.from("payments").insert({
            order_id: orderId,
            provider_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
            provider_session_id: session.id,
            amount: money(session.amount_total) / 100,
            currency: session.currency || "mxn",
            status: "paid",
            raw_event: event as unknown as Record<string, unknown>,
          });

          for (const item of order.order_items || []) {
            const { data: product } = await supabase.from("products").select("*").eq("id", item.product_id).maybeSingle();
            if (!product) continue;
            await supabase
              .from("products")
              .update({ stock: Math.max(Number(product.stock || 0) - Number(item.quantity || 1), 0) })
              .eq("id", item.product_id);
            await supabase.from("community_fund_movements").insert({
              type: "income",
              amount: money(item.community_fund),
              description: `Aportacion por venta de ${item.product_name}`,
              responsible: "Stripe Checkout",
              order_id: orderId,
              cooperative_id: product.cooperative_id,
            });
            await insertTraceabilityStage({
              productId: item.product_id,
              stageKey: "sold",
              stageLabel: "Vendido con pago confirmado",
              description: `Stripe confirmo la compra. Productor: $${item.producer_pay} MXN; fondo comunitario: $${item.community_fund} MXN.`,
              responsible: "Stripe Checkout",
              payload: { orderId, stripeSessionId: session.id },
            });
          }
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

app.use(express.json({ limit: "3mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    supabase: Boolean(PROJECT_URL && SERVICE_KEY),
    stripe: Boolean(stripe),
    polygon: Boolean(POLYGON_RPC_URL && BLOCKCHAIN_PRIVATE_KEY),
  });
});

app.get("/api/auth/profile", requireAuth, (req: AuthedRequest, res) => {
  res.json(req.profile);
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const email = assertString(req.body.email).toLowerCase();
    const password = assertString(req.body.password);
    const fullName = assertString(req.body.fullName, email.split("@")[0] || "Usuario Jnatjo");
    const allowedRoles: ProfileRole[] = ["customer", "producer", "cooperative"];
    const role = allowedRoles.includes(req.body.role) ? req.body.role : "customer";
    const community = assertString(req.body.community, "San Felipe del Progreso");
    const cooperativeId = role === "customer" ? null : assertString(req.body.cooperativeId, "coop-1");

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Ingresa un correo electrónico válido." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        community,
        cooperative_id: cooperativeId,
      },
      app_metadata: {
        role,
      },
    });

    if (createError || !created.user) {
      const message = createError?.message || "No se pudo crear el usuario.";
      const status = /already|registered|exists/i.test(message) ? 409 : 400;
      return res.status(status).json({ error: message });
    }

    const profile = {
      id: created.user.id,
      email,
      full_name: fullName,
      role,
      community,
      cooperative_id: cooperativeId,
    };

    const { data, error } = await supabase.from("profiles").upsert(profile).select("*").single();
    if (error) throw error;

    if (role === "producer") {
      await supabase.from("producers").upsert({
        id: created.user.id,
        user_id: created.user.id,
        name: fullName,
        community,
        cooperative_id: cooperativeId || "coop-1",
        verified: true,
      });
    } else if (role === "cooperative") {
      const { data: cooperative } = await supabase.from("cooperatives").select("id").eq("id", cooperativeId || "coop-1").maybeSingle();
      if (!cooperative) {
        await supabase.from("cooperatives").insert({
          id: cooperativeId || "coop-1",
          name: fullName,
          municipality: "San Felipe del Progreso",
          community,
          representative: fullName,
        });
      }
    }

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/profile", requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const existingProfile = await getProfile(req.user!.id);
    const allowedRoles: ProfileRole[] = ["customer", "producer", "cooperative"];
    const requestedRole = allowedRoles.includes(req.body.role) ? req.body.role : existingProfile?.role || "customer";
    const profile = {
      id: req.user!.id,
      email: req.user!.email || existingProfile?.email || "",
      full_name: assertString(req.body.fullName, existingProfile?.full_name || assertString(req.user!.email?.split("@")[0], "Cliente Jnatjo")),
      role: existingProfile?.role === "admin" ? existingProfile.role : requestedRole,
      community: assertString(req.body.community, existingProfile?.community || "San Felipe del Progreso"),
      cooperative_id: requestedRole === "customer" ? null : assertString(req.body.cooperativeId, existingProfile?.cooperative_id || "coop-1"),
    };
    const { data, error } = await supabase.from("profiles").upsert(profile).select("*").single();
    if (error) throw error;

    if (profile.role === "producer") {
      await supabase.from("producers").upsert({
        id: req.user!.id,
        user_id: req.user!.id,
        name: profile.full_name,
        community: profile.community,
        cooperative_id: profile.cooperative_id || "coop-1",
        verified: true,
      });
    } else if (profile.role === "cooperative") {
      const cooperativeId = profile.cooperative_id || "coop-1";
      const { data: cooperative } = await supabase.from("cooperatives").select("id").eq("id", cooperativeId).maybeSingle();
      if (!cooperative) {
        await supabase.from("cooperatives").insert({
          id: cooperativeId,
          name: profile.full_name,
          municipality: "San Felipe del Progreso",
          community: profile.community,
          representative: profile.full_name,
        });
      }
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/cooperatives", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("cooperatives").select("*").order("name");
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.get("/api/producers", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("producers").select("*").order("name");
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (req, res, next) => {
  try {
    let query = supabase.from("products").select("*, product_images(*)").order("created_at", { ascending: false });
    if (req.query.includePending !== "true") query = query.eq("status", "verified");
    query = query.neq("status", "archived");
    if (req.query.category && req.query.category !== "Todos") query = query.eq("category", String(req.query.category));
    const { data, error } = await query;
    if (error) throw error;
    const rows = await attachProductReviews(data || []);
    res.json(rows.map(mapProduct));
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("products").select("*, product_images(*)").eq("id", req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Producto no encontrado." });
    const [row] = await attachProductReviews([data]);
    res.json(mapProduct(row));
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", requireAuth, requireRoles(["producer", "cooperative", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const producerId = req.profile!.role === "producer" ? req.user!.id : assertString(req.body.producerId);
    const { data: producer } = await supabase.from("producers").select("*").eq("id", producerId).maybeSingle();
    const cooperativeId = assertString(req.body.cooperativeId, producer?.cooperative_id || req.profile!.cooperative_id || "coop-1");
    const { data: cooperative } = await supabase.from("cooperatives").select("*").eq("id", cooperativeId).maybeSingle();

    const price = money(req.body.price);
    const materialItems = (Array.isArray(req.body.materialItems) ? req.body.materialItems : [])
      .map((item: any) => ({
        name: assertString(item.name),
        cost: money(item.cost),
      }))
      .filter((item: any) => item.name || item.cost > 0);
    const materialsCost = materialItems.length > 0
      ? materialItems.reduce((sum: number, item: any) => sum + item.cost, 0)
      : money(req.body.materialsCost);
    const communityFund = money(req.body.communityFund || Math.round(price * 0.1));
    const platformCommission = money(req.body.platformCommission || Math.round(price * 0.15));
    const laborCost = Math.max(money(req.body.laborCost || price - materialsCost - communityFund - platformCommission), 0);
    const id = `prod-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const traceCode = `JNATJO-${Date.now().toString(36).toUpperCase()}`;
    const url = traceUrlFromRequest(req, traceCode);
    const materials = materialItems.length > 0
      ? materialItems.map((item: any) => item.name).join(", ")
      : Array.isArray(req.body.materials)
        ? req.body.materials.join(", ")
        : assertString(req.body.materials);

    const submittedImages = Array.isArray(req.body.images)
      ? req.body.images.map((item: unknown) => assertString(item)).filter(Boolean)
      : [];
    const primaryImage =
      assertString(req.body.image) ||
      submittedImages[0] ||
      "https://images.unsplash.com/photo-1594235412907-9cce44531af8?auto=format&fit=crop&q=80&w=900";
    const images = Array.from(new Set([primaryImage, ...submittedImages].filter(Boolean)));

    const product = {
      id,
      owner_id: req.user!.id,
      name: assertString(req.body.name, "Pieza artesanal Jnatjo"),
      description: assertString(req.body.description),
      category: assertString(req.body.category, "Textiles bordados"),
      price,
      materials,
      craft_hours: money(req.body.craftHours),
      producer_id: producerId || producer?.id || "prod-1",
      producer_name: producer?.name || req.profile!.full_name,
      community: producer?.community || req.profile!.community || "San Felipe del Progreso",
      cooperative_id: cooperativeId,
      cooperative_name: cooperative?.name || "Cooperativa local",
      image: primaryImage,
      stock: Number(req.body.stock || 1),
      status: req.profile!.role === "producer" ? "pending" : "verified",
      trace_code: traceCode,
      qr_payload: url,
      nfc_payload: url,
      materials_cost: materialsCost,
      labor_cost: laborCost,
      community_fund: communityFund,
      platform_commission: platformCommission,
      breakdown: {
        materialsCost,
        laborCost,
        communityFund,
        platformCommission,
        materialItems,
      },
      fair_trade_badges: ["Pago justo", "Produccion artesanal", "Trazabilidad QR"],
    };

    const { data, error } = await supabase.from("products").insert(product).select("*").single();
    if (error) throw error;
    if (images.length > 0) {
      const { error: imageError } = await supabase.from("product_images").insert(
        images.map((imageUrl, index) => ({
          product_id: id,
          url: imageUrl,
          alt: `${product.name} ${index + 1}`,
          sort_order: index,
        })),
      );
      if (imageError) throw imageError;
    }
    await insertTraceabilityStage({
      productId: id,
      stageKey: "registration",
      stageLabel: "Producto registrado",
      description: `${product.producer_name} registro la pieza para validacion comunitaria.`,
      responsible: product.producer_name,
      payload: { traceCode },
      userId: req.user!.id,
    });
    res.status(201).json(mapProduct({ ...data, product_images: images.map((url, index) => ({ url, sort_order: index })) }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/profiles", requireAuth, requireRoles(["admin"]), async (_req: AuthedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, community, cooperative_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/products/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: "Producto no encontrado." });

    const { count, error: countError } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", req.params.id);
    if (countError) throw countError;

    if ((count || 0) > 0) {
      const { error } = await supabase
        .from("products")
        .update({ status: "archived", stock: 0 })
        .eq("id", req.params.id);
      if (error) throw error;
      return res.json({ success: true, archived: true });
    }

    const { error } = await supabase.from("products").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true, deleted: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/profiles/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res, next) => {
  try {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: "No puedes borrar tu propia cuenta administradora." });
    }

    await supabase.from("producers").delete().eq("user_id", req.params.id);
    await supabase.from("producers").delete().eq("id", req.params.id);
    const { error: profileError } = await supabase.from("profiles").delete().eq("id", req.params.id);
    if (profileError) throw profileError;

    const { error: authError } = await supabase.auth.admin.deleteUser(req.params.id);
    if (authError && !/not found|does not exist/i.test(authError.message)) throw authError;

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/cooperatives/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const { data: cooperative, error: cooperativeError } = await supabase
      .from("cooperatives")
      .select("id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (cooperativeError) throw cooperativeError;
    if (!cooperative) return res.status(404).json({ error: "Cooperativa no encontrada." });

    const [
      { count: productCount, error: productError },
      { count: profileCount, error: profileError },
      { count: resourceCount, error: resourceError },
    ] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("cooperative_id", req.params.id).neq("status", "archived"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("cooperative_id", req.params.id),
      supabase.from("shared_resources").select("id", { count: "exact", head: true }).eq("cooperative_id", req.params.id),
    ]);
    if (productError) throw productError;
    if (profileError) throw profileError;
    if (resourceError) throw resourceError;

    const references = Number(productCount || 0) + Number(profileCount || 0) + Number(resourceCount || 0);
    if (references > 0) {
      return res.status(409).json({
        error: "No se puede borrar esta cooperativa porque tiene productos, clientes/productores o recursos asociados. Reasigna o elimina esos registros primero.",
      });
    }

    const { error } = await supabase.from("cooperatives").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/products/:id/stock", requireAuth, requireRoles(["producer", "cooperative", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const amount = Math.max(Math.floor(money(req.body.amount)), 1);
    const { data: product, error: productError } = await supabase.from("products").select("*").eq("id", req.params.id).maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: "Producto no encontrado." });

    const profileName = normalizePersonName(req.profile!.full_name);
    const isOperationsRole = ["admin", "cooperative", "inventory_manager"].includes(req.profile!.role);
    const canUpdate =
      isOperationsRole ||
      product.owner_id === req.user!.id ||
      product.producer_id === req.user!.id ||
      product.cooperative_id === req.profile!.cooperative_id ||
      normalizePersonName(product.producer_name) === profileName;
    if (!canUpdate) return res.status(403).json({ error: "No puedes abastecer este producto." });

    const nextStock = Number(product.stock || 0) + amount;
    const { data, error } = await supabase
      .from("products")
      .update({ stock: nextStock })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;

    await insertTraceabilityStage({
      productId: req.params.id,
      stageKey: "restocked",
      stageLabel: "Producto abastecido",
      description: `${req.profile!.full_name} agrego ${amount} pieza(s) al inventario disponible.`,
      responsible: req.profile!.full_name,
      payload: { amount, stock: nextStock },
      userId: req.user!.id,
    });

    res.json(mapProduct(data));
  } catch (error) {
    next(error);
  }
});

app.post("/api/products/:id/validate", requireAuth, requireRoles(["cooperative", "verifier", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const { data: product, error: productError } = await supabase.from("products").select("*").eq("id", req.params.id).maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: "Producto no encontrado." });
    const { error } = await supabase.from("products").update({ status: "verified" }).eq("id", req.params.id);
    if (error) throw error;
    const stage = await insertTraceabilityStage({
      productId: req.params.id,
      stageKey: "validation",
      stageLabel: "Origen validado por cooperativa",
      description: `${req.profile!.full_name} valido origen, materiales y comercio justo.`,
      responsible: req.profile!.full_name,
      payload: { cooperativeId: product.cooperative_id },
      userId: req.user!.id,
    });
    res.json({ success: true, stage });
  } catch (error) {
    next(error);
  }
});

app.post("/api/products/:id/ship", requireAuth, requireRoles(["producer", "cooperative", "logistics", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const stage = await insertTraceabilityStage({
      productId: req.params.id,
      stageKey: "delivered",
      stageLabel: "Despachado con envio trazable",
      description: `Despachado por ${assertString(req.body.courier, "Logistica comunitaria")} con guia ${assertString(req.body.trackingNumber, "N/A")}.`,
      responsible: req.profile!.full_name,
      payload: { courier: req.body.courier, trackingNumber: req.body.trackingNumber },
      userId: req.user!.id,
    });
    res.json(stage);
  } catch (error) {
    next(error);
  }
});

app.get("/api/traceability/code/:traceCode", async (req, res, next) => {
  try {
    const { data: product, error } = await supabase.from("products").select("*, product_images(*)").eq("trace_code", req.params.traceCode).maybeSingle();
    if (error) throw error;
    if (!product) return res.status(404).json({ error: "Codigo de trazabilidad no encontrado." });
    const { data: stages } = await supabase
      .from("traceability_stages")
      .select("*")
      .eq("product_id", product.id)
      .order("created_at", { ascending: true });
    const { data: anchors } = await supabase
      .from("blockchain_anchors")
      .select("*")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false });
    res.json({ product: mapProduct(product), stages: scopedTraceStages(stages || []).map(publicTraceStage), anchors: anchors || [] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id/traceability", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("traceability_stages")
      .select("*")
      .eq("product_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json(scopedTraceStages(data || []).map(publicTraceStage));
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id/qr", async (req, res, next) => {
  try {
    const { data: product, error } = await supabase.from("products").select("trace_code").eq("id", req.params.id).maybeSingle();
    if (error) throw error;
    if (!product) return res.status(404).json({ error: "Producto no encontrado." });
    const url = traceUrlFromRequest(req, product.trace_code);
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    res.json({ traceUrl: url, dataUrl });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id/qr.png", async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from("products")
      .select("name, trace_code")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!product) return res.status(404).json({ error: "Producto no encontrado." });
    const url = traceUrlFromRequest(req, product.trace_code);
    const buffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 900,
      color: {
        dark: "#101815",
        light: "#FFFFFF",
      },
    });
    const safeName = assertString(product.name, "producto")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename=\"qr-${safeName || "producto"}-${product.trace_code}.png\"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products/:id/confirm-receipt", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const producerRating = Math.min(Math.max(Number(req.body.producerRating || 5), 1), 5);
    const deliveryRating = Math.min(Math.max(Number(req.body.deliveryRating || 5), 1), 5);
    const comments = assertString(req.body.comments);

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: "Producto no encontrado." });

    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .or(`customer_id.eq.${req.user!.id},customer_email.eq.${req.profile!.email}`)
      .in("status", ["paid", "shipped", "delivered"])
      .order("created_at", { ascending: false });
    if (orderError) throw orderError;

    const order = (orders || []).find((candidate: any) =>
      (candidate.order_items || []).some((item: any) => item.product_id === req.params.id),
    );
    if (!order) {
      return res.status(403).json({ error: "Solo el cliente que compró esta pieza puede confirmar recibido y reclamar recompensa." });
    }

    const { data: existing, error: existingError } = await supabase
      .from("traceability_stages")
      .select("*")
      .eq("product_id", req.params.id)
      .eq("stage_key", "received")
      .contains("payload", { orderId: order.id })
      .maybeSingle();
    if (existingError) throw existingError;

    const rewardPoints = Math.max(25, Math.round(money(product.price) * 0.05));
    if (existing) {
      const nextPayload = {
        ...(existing.payload || {}),
        customerId: req.user!.id,
        producerRating,
        deliveryRating,
        comments,
        rewardPoints,
      };
      const { data: updatedStage, error: updateStageError } = await supabase
        .from("traceability_stages")
        .update({
          description: `El cliente actualizó su experiencia de entrega y calificación de esta pieza única.`,
          payload: nextPayload,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updateStageError) throw updateStageError;
      await grantReward({
        customerId: req.user!.id,
        orderId: order.id,
        productId: product.id,
        points: rewardPoints,
        reason: "confirm_receipt",
        payload: { producerRating, deliveryRating },
      });
      return res.json({ success: true, alreadyConfirmed: true, updatedReview: true, rewardPoints, stage: updatedStage });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ fulfillment_status: "delivered" })
      .eq("id", order.id);
    if (updateError) throw updateError;

    await grantReward({
      customerId: req.user!.id,
      orderId: order.id,
      productId: product.id,
      points: rewardPoints,
      reason: "confirm_receipt",
      payload: { producerRating, deliveryRating },
    });

    const stage = await insertTraceabilityStage({
      productId: req.params.id,
      stageKey: "received",
      stageLabel: "Cliente confirmó recibido",
      description: `El cliente verificó la entrega de esta pieza única y obtuvo ${rewardPoints} puntos Jñatjo.`,
      responsible: "Cliente verificado",
      payload: {
        orderId: order.id,
        customerId: req.user!.id,
        producerRating,
        deliveryRating,
        comments,
        rewardPoints,
      },
      userId: req.user!.id,
    });

    res.json({ success: true, rewardPoints, stage });
  } catch (error) {
    next(error);
  }
});

app.get("/api/traceability/verify/:id", async (req, res, next) => {
  try {
    const { data: stages, error } = await supabase
      .from("traceability_stages")
      .select("*")
      .eq("product_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const valid = (stages || []).every((stage, index, rows) => {
      if (index === 0) return stage.hash_previous?.startsWith("0000");
      return stage.hash_previous === rows[index - 1].hash_actual;
    });
    res.json({ verifiedIsValid: valid, valid, chain: (stages || []).map(publicTraceStage) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/blockchain/anchor/:productId", requireAuth, requireRoles(["admin", "cooperative", "verifier"]), async (req: AuthedRequest, res, next) => {
  try {
    const { data: stages, error } = await supabase
      .from("traceability_stages")
      .select("*")
      .eq("product_id", req.params.productId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const anchorHash = sha256((stages || []).map((stage) => stage.hash_actual).join("|"));
    const anchor: Record<string, unknown> = {
      product_id: req.params.productId,
      traceability_stage_id: stages?.at(-1)?.id || null,
      anchor_hash: anchorHash,
      chain_id: AMOY_CHAIN_ID,
      status: "simulated",
    };

    if (POLYGON_RPC_URL && BLOCKCHAIN_PRIVATE_KEY) {
      try {
        const account = privateKeyToAccount(BLOCKCHAIN_PRIVATE_KEY as `0x${string}`);
        const client = createWalletClient({
          account,
          chain: polygonAmoy,
          transport: http(POLYGON_RPC_URL),
        });
        const hash = await (client.sendTransaction as any)({
          to: account.address,
          value: 0n,
          data: `0x${anchorHash}` as `0x${string}`,
          type: "legacy",
        }) as `0x${string}`;
        anchor.tx_hash = hash;
        anchor.status = "submitted";
      } catch (error) {
        anchor.status = "failed";
        anchor.error = error instanceof Error ? error.message : "Blockchain anchoring failed";
      }
    }

    const { data, error: insertError } = await supabase.from("blockchain_anchors").insert(anchor).select("*").single();
    if (insertError) throw insertError;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/resources", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("shared_resources").select("*").order("name");
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/resources", requireAuth, requireRoles(["producer", "cooperative", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const quantity = money(req.body.quantity);
    if (!assertString(req.body.name) || !assertString(req.body.description) || quantity <= 0 || !assertString(req.body.unit)) {
      return res.status(400).json({ error: "Completa nombre, descripcion, cantidad y unidad para registrar el recurso." });
    }
    const id = `res-${Date.now()}`;
    const resource = {
      id,
      name: assertString(req.body.name),
      type: req.body.type === "maquinaria" ? "maquinaria" : "insumo",
      description: assertString(req.body.description),
      quantity,
      unit: assertString(req.body.unit, "unidades"),
      cooperative_id: assertString(req.body.cooperativeId, req.profile!.cooperative_id || "coop-1"),
      rental_cost: money(req.body.rentalCost),
      status: "available",
      available_shared: Boolean(req.body.availableShared ?? true),
      low_stock_threshold: money(req.body.lowStockThreshold || 10),
    };
    const { data, error } = await supabase.from("shared_resources").insert(resource).select("*").single();
    if (error) throw error;
    const { data: movement, error: movementError } = await supabase.from("inventory_movements").insert({
      resource_id: id,
      type: "in",
      quantity: resource.quantity,
      responsible_id: req.user!.id,
      notes: `Registro inicial de ${resource.name}`,
    }).select("*").single();
    if (movementError) throw movementError;
    res.status(201).json({ ...data, movement });
  } catch (error) {
    next(error);
  }
});

app.post("/api/resources/:id/movement", requireAuth, requireRoles(["cooperative", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const quantity = money(req.body.quantity); // Positive amount
    const type = req.body.type === "out" ? "out" : "in";
    const notes = assertString(req.body.notes);

    const { data: resource } = await supabase.from("shared_resources").select("*").eq("id", req.params.id).maybeSingle();
    if (!resource) return res.status(404).json({ error: "Recurso no encontrado." });

    const currentQty = Number(resource.quantity || 0);
    const newQuantity = Math.max(type === "in" ? currentQty + quantity : currentQty - quantity, 0);

    await supabase.from("shared_resources").update({ quantity: newQuantity }).eq("id", req.params.id);

    const movement = {
      resource_id: req.params.id,
      type,
      quantity,
      responsible_id: req.user!.id,
      notes,
    };

    const { data, error } = await supabase.from("inventory_movements").insert(movement).select("*").single();
    if (error) throw error;

    res.json({ success: true, newQuantity, data });
  } catch (error) {
    next(error);
  }
});

app.get("/api/resources/reservations", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { data, error } = await supabase.from("resource_reservations").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.get("/api/resources/movements", requireAuth, async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("inventory_movements").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/resources/reservations", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { data: resource } = await supabase.from("shared_resources").select("*").eq("id", req.body.resourceId).maybeSingle();
    if (!resource) return res.status(404).json({ error: "Recurso no encontrado." });
    const reservation = {
      id: `resv-${Date.now()}`,
      resource_id: resource.id,
      resource_name: resource.name,
      user_id: req.user!.id,
      user_name: req.profile!.full_name,
      cooperative_name: resource.cooperative_id,
      start_date: req.body.startDate,
      end_date: req.body.endDate,
      quantity: Math.max(money(req.body.quantity || 1), 1),
      status: "pending",
      notes: assertString(req.body.notes),
    };
    const { data, error } = await supabase.from("resource_reservations").insert(reservation).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/resources/reservations/:id/status", requireAuth, requireRoles(["cooperative", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const status = ["approved", "completed", "cancelled"].includes(req.body.status) ? req.body.status : "pending";

    const { data: existing } = await supabase
      .from("resource_reservations")
      .select("id, status, resource_id, quantity")
      .eq("id", req.params.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("resource_reservations")
      .update({ status, approved_by: req.user!.id })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;

    if (existing) {
      const qty = money(existing.quantity ?? 1);
      const resourceId = existing.resource_id;
      const prevStatus = existing.status;

      if (status === "approved" && prevStatus === "pending") {
        const { data: resource } = await supabase
          .from("shared_resources")
          .select("quantity")
          .eq("id", resourceId)
          .maybeSingle();
        const newQty = Math.max(money(resource?.quantity) - qty, 0);
        await supabase.from("shared_resources").update({ quantity: newQty }).eq("id", resourceId);
        await supabase.from("inventory_movements").insert({
          resource_id: resourceId,
          type: "loan",
          quantity: qty,
          responsible_id: req.user!.id,
          notes: `Prestamo aprobado — Reserva ${req.params.id.slice(0, 8)}`,
        });
      } else if (status === "cancelled" && prevStatus === "approved") {
        const { data: resource } = await supabase
          .from("shared_resources")
          .select("quantity")
          .eq("id", resourceId)
          .maybeSingle();
        const newQty = money(resource?.quantity) + qty;
        await supabase.from("shared_resources").update({ quantity: newQty }).eq("id", resourceId);
        await supabase.from("inventory_movements").insert({
          resource_id: resourceId,
          type: "return",
          quantity: qty,
          responsible_id: req.user!.id,
          notes: `Prestamo cancelado — Reintegro Reserva ${req.params.id.slice(0, 8)}`,
        });
      }
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/community-fund", async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("community_fund_movements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const balance = (data || []).reduce((sum, item) => {
      if (item.type === "income") return sum + money(item.amount);
      return item.approval_status === "confirmed" ? sum - money(item.amount) : sum;
    }, 0);
    res.json({ balance, movements: data || [] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/rewards/balance", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const summary = await getRewardSummary(req.user!.id);
    res.json({
      earnedPoints: summary.earned,
      redeemedPoints: summary.redeemed,
      availablePoints: summary.available,
      mxnPerPoint: 1,
      maxCheckoutPercent: 20,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/community-fund/expense", requireAuth, requireRoles(["cooperative", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from("community_fund_movements")
      .insert({
        type: "expense",
        amount: money(req.body.amount),
        description: assertString(req.body.description),
        responsible: req.profile!.full_name,
        evidence_url: assertString(req.body.evidenceUrl),
        cooperative_id: req.profile!.cooperative_id,
        approval_status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/community-fund/movements/:id/confirm", requireAuth, requireRoles(["cooperative", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const { data: movement, error: movementError } = await supabase
      .from("community_fund_movements")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (movementError) throw movementError;
    if (!movement) return res.status(404).json({ error: "Movimiento del fondo no encontrado." });
    if (movement.type !== "expense") return res.status(400).json({ error: "Solo los gastos requieren confirmacion." });

    const { data, error } = await supabase
      .from("community_fund_movements")
      .update({
        approval_status: "confirmed",
        approved_by: req.user!.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkout/session", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Configura STRIPE_SECRET_KEY para activar checkout real." });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ error: "El carrito esta vacio." });
    const returnOrigin = safeReturnOrigin(req.body.returnOrigin, req);
    const shipping = req.body.shipping || {};
    const shippingName = assertString(shipping.name, req.profile!.full_name);
    const shippingPhone = assertString(shipping.phone);
    const shippingAddress = assertString(shipping.address);
    const shippingCity = assertString(shipping.city);
    const shippingState = assertString(shipping.state);
    const shippingPostalCode = assertString(shipping.postalCode);
    const shippingNotes = assertString(shipping.notes);

    if (!shippingName || !shippingPhone || !shippingAddress || !shippingCity || !shippingState || !shippingPostalCode) {
      return res.status(400).json({ error: "Completa nombre, telefono, direccion, ciudad, estado y codigo postal de entrega." });
    }

    const productIds = items.map((item) => String(item.productId));
    const { data: products, error } = await supabase.from("products").select("*").in("id", productIds);
    if (error) throw error;

    let subtotal = 0;
    let producerTotal = 0;
    let fundTotal = 0;
    let platformTotal = 0;

    const orderItems = items.map((item) => {
      const product = products?.find((candidate) => candidate.id === item.productId);
      if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);
      const quantity = Math.max(Number(item.quantity || 1), 1);
      if (Number(product.stock || 0) < quantity) {
        throw new Error(`No hay existencias suficientes para ${product.name}. Disponibles: ${Number(product.stock || 0)}.`);
      }
      const unitPrice = money(product.price);
      const producerPay = (money(product.materials_cost) + money(product.labor_cost)) * quantity;
      const communityFund = money(product.community_fund) * quantity;
      const platformCommission = money(product.platform_commission) * quantity;
      subtotal += unitPrice * quantity;
      producerTotal += producerPay;
      fundTotal += communityFund;
      platformTotal += platformCommission;
      return {
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        producer_pay: producerPay,
        community_fund: communityFund,
        platform_commission: platformCommission,
      };
    });
    const requestedRewardPoints = Math.max(Math.floor(money(req.body.redeemPoints)), 0);
    const rewardSummary = requestedRewardPoints > 0 ? await getRewardSummary(req.user!.id) : { available: 0 };
    const maxRewardDiscount = Math.max(Math.floor(subtotal * 0.2), 0);
    const rewardPointsToRedeem = Math.min(requestedRewardPoints, rewardSummary.available, maxRewardDiscount);
    const rewardDiscount = rewardPointsToRedeem;
    const checkoutTotal = Math.max(subtotal - rewardDiscount, 1);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: req.user!.id,
        customer_email: req.profile!.email,
        customer_name: req.profile!.full_name,
        status: "pending",
        subtotal: checkoutTotal,
        producer_total: producerTotal,
        community_fund_total: fundTotal,
        platform_commission_total: platformTotal,
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        shipping_city: shippingCity,
        shipping_state: shippingState,
        shipping_postal_code: shippingPostalCode,
        shipping_notes: shippingNotes,
        fulfillment_status: "pending",
      })
      .select("*")
      .single();
    if (orderError) throw orderError;

    const rows = orderItems.map((item) => ({ ...item, order_id: order.id }));
    const { error: itemError } = await supabase.from("order_items").insert(rows);
    if (itemError) throw itemError;

    if (rewardPointsToRedeem > 0) {
      await redeemReward({
        customerId: req.user!.id,
        orderId: order.id,
        points: rewardPointsToRedeem,
        discountAmount: rewardDiscount,
      });
    }

    const coupon = rewardDiscount > 0
      ? await stripe.coupons.create({
          amount_off: Math.round(rewardDiscount * 100),
          currency: "mxn",
          duration: "once",
          name: `Puntos Jnatjo - $${rewardDiscount} MXN`,
        })
      : null;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: req.profile!.email,
      line_items: orderItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(item.unit_price * 100),
          product_data: {
            name: item.product_name,
          },
        },
      })),
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
      metadata: { orderId: order.id },
      success_url: `${returnOrigin}/?checkout=success&order=${order.id}`,
      cancel_url: `${returnOrigin}/?checkout=cancelled&order=${order.id}`,
    });

    await supabase.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    res.json({ orderId: order.id, url: session.url });
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkout/confirm", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const orderId = req.body.orderId;
    if (!orderId) return res.status(400).json({ error: "Falta el ID de la orden." });

    const { data: order, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) return res.status(404).json({ error: "Orden no encontrada." });

    if (order.status === "paid") {
      return res.json({ success: true, alreadyPaid: true });
    }

    let isPaid = false;
    let paymentIntentId: string | null = null;
    const sessionId = order.stripe_checkout_session_id;

    if (stripe && sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" || session.status === "complete") {
        isPaid = true;
        paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
      }
    } else {
      // Fallback para pruebas simuladas si no hay Stripe configurado o no hay sesión
      isPaid = true;
    }

    if (isPaid) {
      for (const item of order.order_items || []) {
        const { data: product } = await supabase.from("products").select("stock").eq("id", item.product_id).maybeSingle();
        if (product && Number(product.stock || 0) < Number(item.quantity || 1)) {
          return res.status(409).json({ error: `No hay existencias suficientes para ${item.product_name}.` });
        }
      }

      await supabase
        .from("orders")
        .update({
          status: "paid",
          fulfillment_status: "preparing",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq("id", orderId);

      await supabase.from("payments").insert({
        order_id: orderId,
        provider_payment_id: paymentIntentId,
        provider_session_id: sessionId,
        amount: money(order.subtotal),
        currency: order.currency || "mxn",
        status: "paid",
        raw_event: { source: "manual_confirm" },
      });

      for (const item of order.order_items || []) {
        const { data: product } = await supabase.from("products").select("*").eq("id", item.product_id).maybeSingle();
        if (!product) continue;

        await supabase
          .from("products")
          .update({ stock: Math.max(Number(product.stock || 0) - Number(item.quantity || 1), 0) })
          .eq("id", item.product_id);

        await supabase.from("community_fund_movements").insert({
          type: "income",
          amount: money(item.community_fund),
          description: `Aportacion por venta de ${item.product_name}`,
          responsible: "Stripe Checkout",
          order_id: orderId,
          cooperative_id: product.cooperative_id,
        });

        await insertTraceabilityStage({
          productId: item.product_id,
          stageKey: "sold",
          stageLabel: "Vendido con pago confirmado",
          description: `Compra confirmada por Stripe. Productor: $${item.producer_pay} MXN; Fondo comunitario: $${item.community_fund} MXN.`,
          responsible: "Stripe Checkout",
          payload: { orderId, stripeSessionId: sessionId },
        });
      }

      res.json({ success: true });
    } else {
      res.status(400).json({ error: "El pago no se ha completado en Stripe." });
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const scope = String(req.query.scope || "purchases");
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const orders = data || [];

    async function attachRewards(rows: any[]) {
      const orderIds = rows.map((order: any) => order.id);
      if (orderIds.length === 0) return rows;
      const productIds = Array.from(
        new Set(rows.flatMap((order: any) => (order.order_items || []).map((item: any) => item.product_id))),
      );

      const rewardByOrderProduct = new Map<string, number>();
      const rewardByOrder = new Map<string, number>();
      const redeemedByOrder = new Map<string, { points: number; discount: number }>();
      const productById = new Map<string, any>();

      const { data: rewards, error: rewardError } = await supabase
        .from("customer_rewards")
        .select("order_id, product_id, points")
        .in("order_id", orderIds);
      if (rewardError && rewardError.code !== "42P01") throw rewardError;

      for (const reward of rewards || []) {
        const points = Number(reward.points || 0);
        rewardByOrderProduct.set(`${reward.order_id}:${reward.product_id}`, points);
        rewardByOrder.set(reward.order_id, (rewardByOrder.get(reward.order_id) || 0) + points);
      }

      const { data: redemptions, error: redemptionsError } = await supabase
        .from("customer_reward_redemptions")
        .select("order_id, points, discount_amount")
        .in("order_id", orderIds);
      if (redemptionsError && redemptionsError.code !== "42P01") throw redemptionsError;
      for (const redemption of redemptions || []) {
        redeemedByOrder.set(redemption.order_id, {
          points: Number(redemption.points || 0),
          discount: money(redemption.discount_amount),
        });
      }

      if (productIds.length > 0) {
        const { data: productRows, error: productRowsError } = await supabase
          .from("products")
          .select("*, product_images(*)")
          .in("id", productIds);
        if (productRowsError) throw productRowsError;
        for (const product of productRows || []) {
          productById.set(product.id, mapProduct(product));
        }
      }

      if (!rewards || rewards.length === 0) {
        if (productIds.length > 0) {
          const { data: receivedStages, error: receivedError } = await supabase
            .from("traceability_stages")
            .select("product_id, payload")
            .eq("stage_key", "received")
            .in("product_id", productIds);
          if (receivedError) throw receivedError;
          for (const stage of receivedStages || []) {
            const payload = stage.payload || {};
            if (!payload.orderId || typeof payload.rewardPoints !== "number") continue;
            const points = Number(payload.rewardPoints || 0);
            rewardByOrderProduct.set(`${payload.orderId}:${stage.product_id}`, points);
            rewardByOrder.set(String(payload.orderId), (rewardByOrder.get(String(payload.orderId)) || 0) + points);
          }
        }
      }

      return rows.map((order: any) => ({
        ...order,
        reward_points: rewardByOrder.get(order.id) || 0,
        reward_points_redeemed: redeemedByOrder.get(order.id)?.points || 0,
        reward_discount: redeemedByOrder.get(order.id)?.discount || 0,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          rewardPoints: rewardByOrderProduct.get(`${order.id}:${item.product_id}`) || 0,
          product: productById.get(item.product_id) || null,
        })),
      }));
    }

    if (req.profile!.role === "admin" && (scope === "all" || scope === "admin" || scope === "operations")) {
      return res.json(await attachRewards(orders));
    }

    if (scope === "sales" || scope === "operations") {
      const paidOrders = orders.filter((order: any) =>
        ["paid", "shipped", "delivered"].includes(order.status) ||
        ["preparing", "shipped", "delivered"].includes(order.fulfillment_status),
      );
      const productIds = Array.from(
        new Set(paidOrders.flatMap((order: any) => (order.order_items || []).map((item: any) => item.product_id))),
      );
      if (productIds.length === 0) return res.json([]);

      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id, producer_id, producer_name, cooperative_id")
        .in("id", productIds);
      if (productError) throw productError;

      const profileName = normalizePersonName(req.profile!.full_name);
      const allowedProductIds = new Set(
        (products || [])
          .filter((product: any) => {
            if (req.profile!.role === "admin") return true;
            if (req.profile!.role === "cooperative" || req.profile!.role === "inventory_manager" || req.profile!.role === "verifier") {
              return product.cooperative_id === req.profile!.cooperative_id;
            }
            if (scope === "operations") return false;
            if (req.profile!.role === "producer") {
              return product.producer_id === req.user!.id || normalizePersonName(product.producer_name) === profileName;
            }
            return false;
          })
          .map((product: any) => product.id),
      );
      if (allowedProductIds.size === 0) return res.json([]);

      const { data: receivedStages, error: receivedError } = await supabase
        .from("traceability_stages")
        .select("product_id, payload")
        .eq("stage_key", "received")
        .in("product_id", Array.from(allowedProductIds));
      if (receivedError) throw receivedError;

      const reviewByOrderProduct = new Map<string, Record<string, unknown>>();
      for (const stage of receivedStages || []) {
        const payload = stage.payload || {};
        if (payload.orderId) {
          reviewByOrderProduct.set(`${payload.orderId}:${stage.product_id}`, payload);
        }
      }

      const scopedOrders = paidOrders
          .map((order: any) => ({
            ...order,
            order_items: (order.order_items || [])
              .filter((item: any) => allowedProductIds.has(item.product_id))
              .map((item: any) => ({
                ...item,
                review: reviewByOrderProduct.get(`${order.id}:${item.product_id}`) || null,
              })),
          }))
          .filter((order: any) => order.order_items.length > 0);
      return res.json(await attachRewards(scopedOrders));
    }

    const purchaseRows = orders.filter((order: any) => {
        if (order.status === "cancelled" || order.fulfillment_status === "cancelled") return false;
        return order.customer_id === req.user!.id || order.customer_email === req.profile!.email;
      });
    res.json(await attachRewards(purchaseRows));
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders/:id/fulfillment", requireAuth, requireRoles(["cooperative", "inventory_manager", "logistics", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const status = ["preparing", "shipped", "delivered", "cancelled"].includes(req.body.status)
      ? req.body.status
      : "preparing";
    const orderStatus =
      status === "delivered" || status === "shipped" || status === "cancelled"
        ? status
        : "paid";
    const { data, error } = await supabase
      .from("orders")
      .update({ fulfillment_status: status, status: orderStatus })
      .eq("id", req.params.id)
      .select("*, order_items(*)")
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sensors", requireAuth, requireRoles(["logistics", "cooperative", "inventory_manager", "admin"]), async (req: AuthedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from("sensor_readings")
      .insert({
        product_id: assertString(req.body.productId) || null,
        order_id: assertString(req.body.orderId) || null,
        sensor_type: assertString(req.body.sensorType, "temperature"),
        value: money(req.body.value),
        unit: assertString(req.body.unit),
        location: assertString(req.body.location),
        payload: req.body.payload || {},
      })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/community-fund.pdf", async (_req, res, next) => {
  try {
    const { data } = await supabase.from("community_fund_movements").select("*").order("created_at", { ascending: false });
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Jnatjo Market - Reporte de Fondo Comunitario", 14, 18);
    doc.setFontSize(10);
    let y = 30;
    let balance = 0;
    for (const item of data || []) {
      balance += item.type === "income" ? money(item.amount) : -money(item.amount);
      doc.text(`${item.type.toUpperCase()} $${item.amount} MXN - ${item.description}`.slice(0, 100), 14, y);
      y += 8;
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
    }
    doc.setFontSize(13);
    doc.text(`Balance: $${balance} MXN`, 14, y + 8);
    const pdf = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=jnatjo-fondo-comunitario.pdf");
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/producer.pdf", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const profile = req.profile!;
    const producerId = profile.role === "producer"
      ? req.user!.id
      : String(req.query.producerId || req.user!.id);

    const { data: producer } = await supabase
      .from("producers")
      .select("id, name, community, cooperative_id")
      .eq("id", producerId)
      .maybeSingle();

    const { data: productsRows } = await supabase
      .from("products")
      .select("id, name, status, trace_code, price, category")
      .eq("producer_id", producerId);

    const productIds = (productsRows || []).map((p: any) => p.id);

    let salesItems: any[] = [];
    if (productIds.length > 0) {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, product_id, product_name, quantity, unit_price, producer_pay, community_fund, orders(id, status, customer_name, customer_email, created_at)")
        .in("product_id", productIds);
      salesItems = (items || []).filter((item: any) =>
        ["paid", "shipped", "delivered"].includes(item.orders?.status),
      );
    }

    const totalSales = salesItems.reduce((s: number, i: any) => s + money(i.unit_price) * money(i.quantity), 0);
    const totalProducerPay = salesItems.reduce((s: number, i: any) => s + money(i.producer_pay), 0);
    const totalCommunityFund = salesItems.reduce((s: number, i: any) => s + money(i.community_fund), 0);
    const totalUnits = salesItems.reduce((s: number, i: any) => s + money(i.quantity), 0);

    const doc = new jsPDF();
    const pageW = 210;

    // Header band
    doc.setFillColor(45, 45, 42);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setFillColor(90, 106, 66);
    doc.rect(0, 30, pageW, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.text("JNATJO MARKET", 14, 13);
    doc.setFontSize(9);
    doc.text("Reporte Personalizado del Productor", 14, 22);
    const genDate = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`Generado: ${genDate}`, pageW - 14, 22, { align: "right" });

    let y = 40;
    doc.setTextColor(45, 45, 42);
    doc.setFontSize(14);
    doc.text(producer?.name || profile.full_name || "Productor", 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(107, 102, 95);
    if (producer?.community) doc.text(`Comunidad: ${producer.community}`, 14, y);
    y += 12;

    // Summary metrics
    const boxW = (pageW - 28 - 9) / 4;
    const metrics = [
      { label: "VENTAS TOTALES", value: `$${totalSales.toLocaleString("es-MX")}` },
      { label: "PAGO AL PRODUCTOR", value: `$${totalProducerPay.toLocaleString("es-MX")}` },
      { label: "FONDO COMUNITARIO", value: `$${totalCommunityFund.toLocaleString("es-MX")}` },
      { label: "UNIDADES VENDIDAS", value: String(totalUnits) },
    ];
    for (let i = 0; i < metrics.length; i++) {
      const bx = 14 + i * (boxW + 3);
      doc.setFillColor(250, 248, 245);
      doc.setDrawColor(230, 226, 218);
      doc.rect(bx, y, boxW, 22, "FD");
      doc.setFontSize(6.5);
      doc.setTextColor(107, 102, 95);
      doc.text(metrics[i].label, bx + 3, y + 7);
      doc.setFontSize(11);
      doc.setTextColor(45, 45, 42);
      doc.text(metrics[i].value, bx + 3, y + 17);
    }
    y += 30;

    // Products section
    doc.setFontSize(10);
    doc.setTextColor(45, 45, 42);
    doc.text("Piezas Registradas", 14, y);
    y += 4;
    doc.setFillColor(90, 106, 66);
    doc.rect(14, y, pageW - 28, 0.5, "F");
    y += 7;
    doc.setFontSize(8);
    doc.setTextColor(107, 102, 95);
    const totalReg = (productsRows || []).length;
    const totalVerif = (productsRows || []).filter((p: any) => p.status === "verified").length;
    doc.text(`Total registradas: ${totalReg}  |  Verificadas: ${totalVerif}  |  Pendientes: ${totalReg - totalVerif}`, 14, y);
    y += 12;

    // Sales table
    doc.setFontSize(10);
    doc.setTextColor(45, 45, 42);
    doc.text("Detalle de Ventas Confirmadas", 14, y);
    y += 4;
    doc.setFillColor(90, 106, 66);
    doc.rect(14, y, pageW - 28, 0.5, "F");
    y += 8;

    // Table header row
    const cols = [14, 34, 62, 130, 152, 175];
    const headers = ["FECHA", "ORDEN", "PRODUCTO", "CANT.", "PRECIO U.", "PAGO PROD."];
    doc.setFillColor(239, 237, 231);
    doc.rect(14, y - 5, pageW - 28, 7, "F");
    doc.setFontSize(7);
    doc.setTextColor(107, 102, 95);
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], cols[i], y);
    }
    y += 5;

    if (salesItems.length === 0) {
      doc.setFontSize(8);
      doc.setTextColor(138, 132, 124);
      doc.text("No hay ventas confirmadas registradas aun.", 14, y + 6);
    } else {
      doc.setFontSize(7.5);
      for (const item of salesItems) {
        if (y > 270) { doc.addPage(); y = 18; }
        const d = new Date(item.orders?.created_at || "");
        const dateStr = Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
        doc.setTextColor(107, 102, 95);
        doc.text(dateStr, cols[0], y);
        doc.setTextColor(45, 45, 42);
        doc.text((item.orders?.id || "").slice(0, 8).toUpperCase(), cols[1], y);
        doc.text((item.product_name || "").slice(0, 34), cols[2], y);
        doc.text(String(item.quantity), cols[3], y);
        doc.text(`$${money(item.unit_price).toLocaleString("es-MX")}`, cols[4], y);
        doc.setTextColor(90, 106, 66);
        doc.text(`$${money(item.producer_pay).toLocaleString("es-MX")}`, cols[5], y);
        y += 7;
        doc.setDrawColor(230, 226, 218);
        doc.line(14, y - 2, pageW - 14, y - 2);
      }
    }

    y += 10;
    doc.setFontSize(7);
    doc.setTextColor(138, 132, 124);
    doc.text("Jnatjo Market - Comercio Justo y Trazabilidad Artesanal", 14, y);

    const pdf = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=jnatjo-reporte-productor.pdf");
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/cooperative.pdf", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const profile = req.profile!;
    const cooperativeId = ["cooperative", "verifier", "inventory_manager", "logistics"].includes(profile.role)
      ? profile.cooperative_id || String(req.query.cooperativeId || "coop-1")
      : String(req.query.cooperativeId || "coop-1");

    const { data: coop } = await supabase
      .from("cooperatives")
      .select("id, name, municipality, community, representative")
      .eq("id", cooperativeId)
      .maybeSingle();

    const { data: coopProducts } = await supabase
      .from("products")
      .select("id, name, status, producer_name, producer_id, category")
      .eq("cooperative_id", cooperativeId);

    const coopProductIds = new Set((coopProducts || []).map((p: any) => p.id));

    const { data: allOrders } = await supabase
      .from("orders")
      .select("id, status, customer_name, customer_email, subtotal, producer_total, community_fund_total, platform_commission_total, fulfillment_status, created_at, order_items(product_id, product_name, quantity, unit_price, producer_pay, community_fund)")
      .in("status", ["paid", "shipped", "delivered"])
      .order("created_at", { ascending: false });

    const relevantOrders = (allOrders || []).filter((order: any) =>
      (order.order_items || []).some((item: any) => coopProductIds.has(item.product_id)),
    );

    const { data: reservations } = await supabase
      .from("resource_reservations")
      .select("id, resource_name, user_name, status, start_date, end_date")
      .order("created_at", { ascending: false })
      .limit(50);

    const totalOrders = relevantOrders.length;
    const totalRevenue = relevantOrders.reduce((s: number, o: any) => s + money(o.subtotal), 0);
    const totalProducerPay = relevantOrders.reduce((s: number, o: any) => s + money(o.producer_total), 0);
    const totalFund = relevantOrders.reduce((s: number, o: any) => s + money(o.community_fund_total), 0);
    const totalPlatform = relevantOrders.reduce((s: number, o: any) => s + money(o.platform_commission_total), 0);
    const totalProducts = (coopProducts || []).length;
    const verifiedProducts = (coopProducts || []).filter((p: any) => p.status === "verified").length;

    const doc = new jsPDF();
    const pageW = 210;

    // Header band
    doc.setFillColor(45, 45, 42);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setFillColor(194, 132, 93);
    doc.rect(0, 30, pageW, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.text("JNATJO MARKET", 14, 13);
    doc.setFontSize(9);
    doc.text("Reporte de Cooperativa", 14, 22);
    const genDate2 = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`Generado: ${genDate2}`, pageW - 14, 22, { align: "right" });

    let y = 40;
    doc.setTextColor(45, 45, 42);
    doc.setFontSize(14);
    doc.text(coop?.name || "Cooperativa", 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(107, 102, 95);
    const coopMeta = [coop?.municipality, coop?.community, coop?.representative ? `Representante: ${coop.representative}` : ""].filter(Boolean).join("  |  ");
    if (coopMeta) doc.text(coopMeta, 14, y);
    y += 12;

    // Summary metrics (2 rows of 3)
    const mBoxW = (pageW - 28 - 6) / 3;
    const mMetrics = [
      { label: "ORDENES GESTIONADAS", value: String(totalOrders) },
      { label: "INGRESOS TOTALES", value: `$${totalRevenue.toLocaleString("es-MX")}` },
      { label: "PAGOS A PRODUCTORES", value: `$${totalProducerPay.toLocaleString("es-MX")}` },
      { label: "FONDO COMUNITARIO", value: `$${totalFund.toLocaleString("es-MX")}` },
      { label: "COMISION PLATAFORMA", value: `$${totalPlatform.toLocaleString("es-MX")}` },
      { label: "PRODUCTOS REGISTRADOS", value: `${verifiedProducts}/${totalProducts} verif.` },
    ];
    for (let i = 0; i < mMetrics.length; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const bx = 14 + col * (mBoxW + 3);
      const by = y + row * 26;
      doc.setFillColor(250, 248, 245);
      doc.setDrawColor(230, 226, 218);
      doc.rect(bx, by, mBoxW, 22, "FD");
      doc.setFontSize(6.5);
      doc.setTextColor(107, 102, 95);
      doc.text(mMetrics[i].label, bx + 3, by + 7);
      doc.setFontSize(11);
      doc.setTextColor(45, 45, 42);
      doc.text(mMetrics[i].value, bx + 3, by + 17);
    }
    y += 58;

    // Orders table
    doc.setFontSize(10);
    doc.setTextColor(45, 45, 42);
    doc.text("Historial de Ordenes", 14, y);
    y += 4;
    doc.setFillColor(194, 132, 93);
    doc.rect(14, y, pageW - 28, 0.5, "F");
    y += 8;

    const oCols = [14, 34, 82, 132, 162, 186];
    const oHeaders = ["FECHA", "ORDEN", "CLIENTE", "TOTAL", "PROD. PAGO", "ESTADO"];
    doc.setFillColor(239, 237, 231);
    doc.rect(14, y - 5, pageW - 28, 7, "F");
    doc.setFontSize(7);
    doc.setTextColor(107, 102, 95);
    for (let i = 0; i < oHeaders.length; i++) doc.text(oHeaders[i], oCols[i], y);
    y += 5;

    if (relevantOrders.length === 0) {
      doc.setFontSize(8);
      doc.setTextColor(138, 132, 124);
      doc.text("No hay ordenes gestionadas registradas aun.", 14, y + 6);
    } else {
      doc.setFontSize(7);
      for (const order of relevantOrders) {
        if (y > 270) { doc.addPage(); y = 18; }
        const d = new Date(order.created_at || "");
        const dateStr = Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
        const customer = (order.customer_name || order.customer_email || "").slice(0, 22);
        doc.setTextColor(107, 102, 95);
        doc.text(dateStr, oCols[0], y);
        doc.setTextColor(45, 45, 42);
        doc.text(order.id.slice(0, 8).toUpperCase(), oCols[1], y);
        doc.text(customer, oCols[2], y);
        doc.text(`$${money(order.subtotal).toLocaleString("es-MX")}`, oCols[3], y);
        doc.setTextColor(90, 106, 66);
        doc.text(`$${money(order.producer_total).toLocaleString("es-MX")}`, oCols[4], y);
        doc.setTextColor(45, 45, 42);
        doc.text(String(order.fulfillment_status || order.status || "-").slice(0, 10), oCols[5], y);
        y += 7;
        doc.setDrawColor(230, 226, 218);
        doc.line(14, y - 2, pageW - 14, y - 2);
      }
    }

    // Reservations section
    if (y < 240 && (reservations || []).length > 0) {
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(45, 45, 42);
      doc.text("Reservas de Maquinaria y Recursos", 14, y);
      y += 4;
      doc.setFillColor(194, 132, 93);
      doc.rect(14, y, pageW - 28, 0.5, "F");
      y += 8;

      const rCols = [14, 72, 116, 152, 178];
      const rHeaders = ["RECURSO", "SOLICITANTE", "INICIO", "FIN", "ESTADO"];
      doc.setFillColor(239, 237, 231);
      doc.rect(14, y - 5, pageW - 28, 7, "F");
      doc.setFontSize(7);
      doc.setTextColor(107, 102, 95);
      for (let i = 0; i < rHeaders.length; i++) doc.text(rHeaders[i], rCols[i], y);
      y += 5;

      doc.setFontSize(7);
      for (const rsv of reservations || []) {
        if (y > 275) break;
        const ds = new Date(rsv.start_date).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
        const de = new Date(rsv.end_date).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
        doc.setTextColor(45, 45, 42);
        doc.text((rsv.resource_name || "").slice(0, 26), rCols[0], y);
        doc.text((rsv.user_name || "").slice(0, 20), rCols[1], y);
        doc.text(ds, rCols[2], y);
        doc.text(de, rCols[3], y);
        doc.setTextColor(rsv.status === "approved" ? 90 : rsv.status === "cancelled" ? 164 : 45, rsv.status === "approved" ? 106 : 45, rsv.status === "approved" ? 66 : 42);
        doc.text(String(rsv.status || "-"), rCols[4], y);
        y += 6;
        doc.setDrawColor(230, 226, 218);
        doc.line(14, y - 1.5, pageW - 14, y - 1.5);
      }
    }

    y += 10;
    doc.setFontSize(7);
    doc.setTextColor(138, 132, 124);
    doc.text("Jnatjo Market - Comercio Justo y Trazabilidad Artesanal", 14, y);

    const pdf = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=jnatjo-reporte-cooperativa.pdf");
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Error interno del servidor." });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Jnatjo Market API listening on http://localhost:${PORT}`);
  });
}

startServer();
