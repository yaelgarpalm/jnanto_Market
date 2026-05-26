export type UserRole =
  | "customer"
  | "producer"
  | "cooperative"
  | "verifier"
  | "inventory_manager"
  | "logistics"
  | "admin";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  community: string | null;
  cooperative_id: string | null;
  stripe_customer_id?: string | null;
  stripe_account_id?: string | null;
}

export interface Cooperative {
  id: string;
  name: string;
  municipality: string;
  community: string;
  representative: string;
  phone?: string;
}

export interface Producer {
  id: string;
  user_id?: string | null;
  name: string;
  community: string;
  cooperative_id: string;
  description?: string;
  verified: boolean;
  avatar?: string;
}

export interface PriceBreakdown {
  materialsCost: number;
  laborCost: number;
  communityFund: number;
  platformCommission: number;
  materialItems?: MaterialItem[];
}

export interface MaterialItem {
  name: string;
  cost: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  materials: string[];
  craftHours: number;
  producerId: string;
  producerName: string;
  community: string;
  cooperativeId: string;
  cooperativeName: string;
  image: string;
  images?: string[];
  stock: number;
  status: "verified" | "pending" | "archived";
  traceCode: string;
  breakdown: PriceBreakdown;
  fairTradeBadges: string[];
  rating?: number;
  reviewCount?: number;
  qrPayload?: string;
  nfcPayload?: string;
  associatedResources?: string[];
}

export interface TraceabilityStage {
  id: string;
  product_id: string;
  stage_key: string;
  stage_label: string;
  description: string;
  date: string;
  responsible: string;
  evidence_url?: string;
  hash_actual: string;
  hash_previous: string;
  payload?: Record<string, unknown>;
  anchored?: boolean;
}

export interface BlockchainAnchor {
  id: string;
  product_id: string;
  traceability_stage_id?: string | null;
  chain_id: number;
  anchor_hash: string;
  tx_hash?: string | null;
  block_number?: number | null;
  status: "pending" | "submitted" | "confirmed" | "failed" | "simulated";
  error?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";
  customer_email?: string;
  customer_name?: string;
  subtotal: number;
  producer_total: number;
  community_fund_total: number;
  platform_commission_total: number;
  fulfillment_status?: "pending" | "preparing" | "shipped" | "delivered" | "cancelled";
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string | null;
  shipping_notes?: string | null;
  created_at: string;
  order_items?: OrderItem[];
  reward_points?: number;
  reward_points_redeemed?: number;
  reward_discount?: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  producer_pay: number;
  community_fund: number;
  platform_commission: number;
  review?: {
    producerRating?: number;
    deliveryRating?: number;
    comments?: string;
    rewardPoints?: number;
  } | null;
  rewardPoints?: number;
  product?: Product | null;
}

export interface CommunityResource {
  id: string;
  name: string;
  type: "insumo" | "maquinaria";
  description: string;
  quantity: number;
  unit: string;
  cooperative_id: string;
  rental_cost?: number | null;
  status: "available" | "unavailable" | "maintenance";
  available_shared: boolean;
  low_stock_threshold: number;
}

export interface ResourceReservation {
  id: string;
  resource_id: string;
  resource_name: string;
  user_id: string;
  user_name: string;
  cooperative_name: string;
  start_date: string;
  end_date: string;
  quantity: number;
  status: "pending" | "approved" | "completed" | "cancelled";
  notes?: string;
}

export interface CommunityFundMovement {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  responsible?: string;
  evidence_url?: string;
  created_at: string;
}
