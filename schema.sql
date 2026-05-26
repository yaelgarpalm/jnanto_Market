-- Jnatjo Market Supabase schema reference.
-- The live project migration was applied to project ref siggyxazymwuqgfhsiqb.
-- Use Supabase migrations/MCP for production changes; this file documents the target model.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'customer',
  community text,
  cooperative_id text,
  stripe_customer_id text,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.blockchain_anchors (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  traceability_stage_id text references public.traceability_stages(id) on delete set null,
  chain_id int not null default 80002,
  anchor_hash text not null,
  tx_hash text,
  block_number bigint,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_email text,
  customer_name text,
  status text not null default 'pending',
  currency text not null default 'mxn',
  subtotal numeric not null default 0,
  producer_total numeric not null default 0,
  community_fund_total numeric not null default 0,
  platform_commission_total numeric not null default 0,
  shipping_name text,
  shipping_phone text,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  shipping_notes text,
  fulfillment_status text not null default 'pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric not null,
  producer_pay numeric not null default 0,
  community_fund numeric not null default 0,
  platform_commission numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_id text,
  provider_session_id text,
  amount numeric not null,
  currency text not null default 'mxn',
  status text not null default 'pending',
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  points int not null check (points > 0),
  reason text not null default 'confirm_receipt',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (customer_id, order_id, product_id, reason)
);

create table if not exists public.customer_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  points int not null check (points > 0),
  discount_amount numeric not null check (discount_amount > 0),
  currency text not null default 'mxn',
  reason text not null default 'checkout_discount',
  created_at timestamptz not null default now(),
  unique (order_id)
);

create table if not exists public.community_fund_movements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric not null check (amount >= 0),
  description text not null,
  responsible text,
  evidence_url text,
  order_id uuid references public.orders(id) on delete set null,
  cooperative_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  resource_id text not null references public.shared_resources(id) on delete cascade,
  type text not null,
  quantity numeric not null,
  responsible_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  sensor_type text not null,
  value numeric,
  unit text,
  location text,
  recorded_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

-- RLS is enabled on all public tables in the live migration.
-- Storage:
-- - Public bucket `product-images` stores product photos uploaded from the app.
-- - Authenticated users can insert objects into that bucket.
-- - No broad SELECT policy is required for public object URLs, which avoids exposing bucket listing via the API.
