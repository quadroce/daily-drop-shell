-- Create onboarding_reminders table with indexes
create table if not exists public.onboarding_reminders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt_count int not null default 0,
  last_sent_at timestamptz,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes for performance
create index if not exists idx_onbrem_last_sent on public.onboarding_reminders(last_sent_at);
create index if not exists idx_onbrem_paused on public.onboarding_reminders(paused);

-- Enable RLS on onboarding_reminders
alter table public.onboarding_reminders enable row level security;

-- Policy: only service role can read/write for automated processing
create policy "Service role can manage onboarding reminders"
  on public.onboarding_reminders
  for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- Policy: users can view their own reminder status
create policy "Users can view own reminder status"
  on public.onboarding_reminders
  for select
  using (auth.uid() = user_id);

-- RPC function to allow users to pause/unpause their reminders
create or replace function public.pause_onboarding_reminders(p_paused boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.onboarding_reminders (user_id, paused, updated_at)
  values (auth.uid(), p_paused, now())
  on conflict (user_id) 
  do update set 
    paused = p_paused, 
    updated_at = now();
$$;