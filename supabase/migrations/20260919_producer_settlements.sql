-- Business rules: producer settlements and cooperative payouts (DEF-043 / DEF-044).
-- Applied to Supabase project siggyxazymwuqgfhsiqb on 2026-09-19.

create table if not exists public.producer_settlements (
  id uuid primary key default gen_random_uuid(),
  producer_id text not null references public.producers(id) on delete restrict,
  cooperative_id text not null references public.cooperatives(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  amount numeric not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  payment_method text,
  payment_reference text,
  evidence_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  paid_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (period_start <= period_end)
);

create table if not exists public.producer_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.producer_settlements(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (settlement_id, order_item_id)
);

create index if not exists producer_settlements_cooperative_idx
  on public.producer_settlements(cooperative_id, period_start, period_end);

create index if not exists producer_settlements_producer_idx
  on public.producer_settlements(producer_id, period_start, period_end);

alter table public.producer_settlements enable row level security;
alter table public.producer_settlement_items enable row level security;

drop policy if exists producer_settlements_admin_only on public.producer_settlements;
create policy producer_settlements_admin_only on public.producer_settlements
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

drop policy if exists producer_settlement_items_admin_only on public.producer_settlement_items;
create policy producer_settlement_items_admin_only on public.producer_settlement_items
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));
