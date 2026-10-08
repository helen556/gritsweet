-- Supabase: правила доступу. Виконати в SQL Editor ПІСЛЯ `npm run db:setup` (створює таблиці).
--
-- Модель доступу: браузер НІКОЛИ не звертається до Supabase напряму. Усі запити йдуть через
-- сервер Next.js (DATABASE_URL — пряме з'єднання Postgres; SUPABASE_SERVICE_ROLE_KEY — лише сервер).
-- Тому для ролей anon/authenticated (PostgREST з публічним ключем) вмикаємо RLS БЕЗ політик = доступ заборонено.

do $$
declare t text;
begin
  foreach t in array array[
    'admin_users','products','product_translations','product_variants','orders','order_items',
    'payment_events','fulfillments','download_grants','email_deliveries','contact_messages',
    'settings','audit_log','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Приватний bucket для куплених PDF (не публічний; доступ лише через service role на сервері)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-books', 'private-books', false, 104857600, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Жодних політик для anon/authenticated на storage.objects цього bucket → прямий доступ заборонено.
-- (Service role обходить RLS, тому сервер може читати/записувати файли.)

-- Примітка: роль, під якою підключається DATABASE_URL (зазвичай postgres), є власником таблиць.
-- FORCE RLS діє і на власника, тому для неї потрібна політика повного доступу:
do $$
declare t text;
begin
  foreach t in array array[
    'admin_users','products','product_translations','product_variants','orders','order_items',
    'payment_events','fulfillments','download_grants','email_deliveries','contact_messages',
    'settings','audit_log','rate_limits'
  ] loop
    execute format('drop policy if exists server_all on public.%I', t);
    execute format('create policy server_all on public.%I for all to postgres using (true) with check (true)', t);
  end loop;
end $$;
