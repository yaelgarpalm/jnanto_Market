-- Security hardening for DEF-034 and payment idempotency for DEF-026.
-- Applied to Supabase project siggyxazymwuqgfhsiqb on 2026-09-18.

create unique index if not exists payments_provider_session_id_uidx
  on public.payments(provider_session_id)
  where provider_session_id is not null;

revoke execute on function public.register_route_device(text,text,text,text,uuid,text,numeric,numeric,numeric,jsonb)
  from public, anon, authenticated;

drop policy if exists route_sessions_authenticated_insert on public.route_sessions;
drop policy if exists route_sessions_authenticated_select on public.route_sessions;
drop policy if exists route_sessions_authenticated_update on public.route_sessions;
drop policy if exists route_stops_authenticated_delete on public.route_stops;
drop policy if exists route_stops_authenticated_insert on public.route_stops;
drop policy if exists route_stops_authenticated_select on public.route_stops;
drop policy if exists route_stops_authenticated_update on public.route_stops;

create policy route_sessions_admin_only on public.route_sessions
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

create policy route_stops_admin_only on public.route_stops
  for all to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));


-- RLS hardening for tables that previously had RLS enabled without policies.
do $$
declare
  t text;
  tables text[] := array[
    'customer_rewards','device_events','route_devices','traceai_alerts',
    'traceai_anomalies','traceai_audit_log','traceai_devices','traceai_events',
    'traceai_lots','traceai_predictions','traceai_readings',
    'traceai_risk_assessments','traceai_sensors'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_only', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())))',
      t || '_admin_only', t
    );
  end loop;
end $$;
