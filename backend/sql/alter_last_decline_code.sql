-- One-shot for existing projects. Run in the Supabase SQL editor.
-- Stripe decline on Tuesday charge — owner/admin only (never customer-facing).

alter table public.subscriptions
  add column if not exists last_decline_code text;

alter table public.subscriptions
  add column if not exists last_decline_at timestamptz;
