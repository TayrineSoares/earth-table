/* One-shot for existing projects. Run in the Supabase SQL editor. */

alter table public.subscriptions
  add column if not exists card_updated_at timestamptz;
