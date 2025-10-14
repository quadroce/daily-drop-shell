-- YouTube Comments Templates
create table if not exists public.youtube_comment_templates (
  id bigserial primary key,
  label text not null,
  body_template text not null,
  uses_ai_variation boolean default false,
  ai_system_prompt text,
  active boolean default true,
  min_interval_minutes int default 0,
  include_topic_name boolean default true,
  include_topic_url_every_n int default 0,
  must_start_with_prefixes text[] default '{}',
  no_emojis boolean default true,
  max_length int default 280,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- YouTube Comment Jobs (enhance existing social_comment_jobs if needed)
alter table if exists public.social_comment_jobs 
  add column if not exists template_id bigint references public.youtube_comment_templates(id);

-- YouTube Comment Events
create table if not exists public.youtube_comment_events (
  id bigserial primary key,
  job_id bigint references public.social_comment_jobs(id) on delete cascade,
  stage text not null,
  ok boolean,
  meta jsonb,
  created_at timestamptz default now()
);

-- Shorts Jobs
create table if not exists public.short_jobs (
  id bigserial primary key,
  platform text check (platform in ('youtube','linkedin')) not null,
  slot int check (slot in (1,2)) not null,
  topic_slug text not null,
  kind text check (kind in ('recap','highlight')) not null,
  scheduled_for timestamptz not null,
  status text check (status in ('queued','running','done','error','skipped','canceled')) default 'queued',
  tries int default 0,
  error_code text,
  error_message text,
  external_id text,
  script_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Shorts Job Events
create table if not exists public.short_job_events (
  id bigserial primary key,
  job_id bigint references public.short_jobs(id) on delete cascade,
  stage text not null,
  ok boolean,
  meta jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_ycj_status_created on public.social_comment_jobs(status, created_at);
create index if not exists idx_short_jobs_status_sched on public.short_jobs(status, scheduled_for);

-- App Settings for config
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- RLS Policies for Admin access
alter table public.youtube_comment_templates enable row level security;
drop policy if exists "Admin can manage templates" on public.youtube_comment_templates;
create policy "Admin can manage templates"
  on public.youtube_comment_templates
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );

alter table public.short_jobs enable row level security;
drop policy if exists "Admin can manage shorts jobs" on public.short_jobs;
create policy "Admin can manage shorts jobs"
  on public.short_jobs
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );

alter table public.short_job_events enable row level security;
drop policy if exists "Admin can view shorts events" on public.short_job_events;
create policy "Admin can view shorts events"
  on public.short_job_events
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );

alter table public.app_settings enable row level security;
drop policy if exists "Admin can manage settings" on public.app_settings;
create policy "Admin can manage settings"
  on public.app_settings
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );