-- Create indexes for infinite scroll performance
create index if not exists idx_drops_score_pub_id
  on public.drops (score desc, published_at desc, id desc);

create index if not exists idx_drops_language on public.drops (language);
create index if not exists idx_drops_l1_topic on public.drops (l1_topic_id);
create index if not exists idx_drops_l2_topic on public.drops (l2_topic_id);

-- User feed cache indexes
create index if not exists idx_user_feed_cache_user_score
  on public.user_feed_cache (user_id, final_score desc, created_at desc, drop_id desc);

create index if not exists idx_user_feed_cache_user_exp
  on public.user_feed_cache (user_id, expires_at desc);

-- Cursor-based RPC for infinite scroll
create or replace function public.feed_get_page_drops(
  p_user_id uuid,
  p_limit int default 30,
  p_cursor text default null,
  p_language text default null,
  p_l1 bigint default null,
  p_l2 bigint default null
)
returns table (
  id bigint,
  title text,
  url text,
  source_id bigint,
  image_url text,
  summary text,
  published_at timestamptz,
  language text,
  tags text[],
  l1_topic_id int,
  l2_topic_id int,
  final_score numeric,
  reason_for_ranking text,
  youtube_video_id text,
  youtube_channel_id text,
  youtube_thumbnail_url text,
  source_name text,
  type drop_type
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c_score numeric;
  c_published timestamptz;
  c_id bigint;
begin
  -- decode cursor if provided: base64("final_score:published_iso:id")
  if p_cursor is not null then
    with decoded as (
      select
        split_part(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 1)::numeric as s,
        split_part(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 2)::timestamptz as t,
        split_part(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 3)::bigint as i
    )
    select s, t, i into c_score, c_published, c_id from decoded;
  end if;

  return query
  with base as (
    select
      d.id, d.title, d.url, d.source_id, d.image_url, d.summary,
      d.published_at, d.language, d.tags, d.l1_topic_id, d.l2_topic_id,
      coalesce(uf.final_score, d.score::numeric) as final_score,
      coalesce(uf.reason_for_ranking, 'Relevant content') as reason_for_ranking,
      d.youtube_video_id, d.youtube_channel_id, d.youtube_thumbnail_url,
      s.name as source_name,
      d.type
    from public.drops d
    left join public.sources s on s.id = d.source_id
    left join public.user_feed_cache uf
      on uf.drop_id = d.id
     and uf.user_id = p_user_id
     and uf.expires_at > now()      -- use cache only when fresh
    where d.tag_done = true
      and (p_language is null or d.language = p_language)
      and (p_l1 is null or d.l1_topic_id = p_l1)
      and (p_l2 is null or d.l2_topic_id = p_l2)
      and (
        p_cursor is null
        or (coalesce(uf.final_score, d.score::numeric), d.published_at, d.id) < (c_score, c_published, c_id)
      )
  )
  select *
  from base
  order by final_score desc, published_at desc, id desc
  limit greatest(p_limit, 1);
end;
$$;

-- Grant permissions
revoke all on function public.feed_get_page_drops(uuid,int,text,text,bigint,bigint) from public;
grant execute on function public.feed_get_page_drops(uuid,int,text,text,bigint,bigint) to authenticated;