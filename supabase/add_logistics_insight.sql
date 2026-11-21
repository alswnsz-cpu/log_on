-- LOG:ON 물류 인사이트 신규 테이블 및 접근 정책
-- 선행: schema.sql 및 기존 is_approved(), is_officer(), profiles
-- 실행 전 백업 및 시험용 DB 검증. 운영 적용은 관리자만 수행.
begin;
create table public.insight_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category text not null check (category in ('해운·항만','항공','SCM','유통','무역','물류기술','기타')),
  source text not null check (char_length(btrim(source)) between 1 and 200),
  source_url text not null check (char_length(source_url) <= 2048 and source_url ~* '^https?://[^[:space:]]+$'),
  article_date date not null,
  summary text not null check (char_length(btrim(summary)) between 1 and 3000),
  takeaway text not null default '' check (char_length(takeaway) <= 2000),
  created_at timestamptz not null default now()
);
create table public.insight_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.insight_posts(id) on delete cascade,
  user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table public.insight_likes (
  post_id uuid not null references public.insight_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create table public.insight_bookmarks (
  post_id uuid not null references public.insight_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create index insight_posts_created_idx on public.insight_posts(created_at desc);
create index insight_posts_user_idx on public.insight_posts(user_id);
create index insight_comments_post_idx on public.insight_comments(post_id,created_at);
create index insight_comments_user_idx on public.insight_comments(user_id);
create index insight_likes_user_idx on public.insight_likes(user_id);
create index insight_bookmarks_user_idx on public.insight_bookmarks(user_id);
alter table public.insight_posts enable row level security;
alter table public.insight_comments enable row level security;
alter table public.insight_likes enable row level security;
alter table public.insight_bookmarks enable row level security;
revoke all on public.insight_posts, public.insight_comments, public.insight_likes, public.insight_bookmarks from public, anon, authenticated;
grant select, delete on public.insight_posts, public.insight_comments, public.insight_likes, public.insight_bookmarks to authenticated;
grant insert (title,category,source,source_url,article_date,summary,takeaway), update (title,category,source,source_url,article_date,summary,takeaway) on public.insight_posts to authenticated;
grant insert (post_id,content), update (content) on public.insight_comments to authenticated;
grant insert (post_id) on public.insight_likes, public.insight_bookmarks to authenticated;
create policy insight_posts_select on public.insight_posts for select to authenticated using (public.is_approved());
create policy insight_posts_insert on public.insight_posts for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy insight_posts_update on public.insight_posts for update to authenticated using (public.is_approved() and user_id = auth.uid()) with check (public.is_approved() and user_id = auth.uid());
create policy insight_posts_delete on public.insight_posts for delete to authenticated using (public.is_approved() and (user_id = auth.uid() or public.is_officer()));
create policy insight_comments_select on public.insight_comments for select to authenticated using (public.is_approved());
create policy insight_comments_insert on public.insight_comments for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy insight_comments_update on public.insight_comments for update to authenticated using (public.is_approved() and user_id = auth.uid()) with check (public.is_approved() and user_id = auth.uid());
create policy insight_comments_delete on public.insight_comments for delete to authenticated using (public.is_approved() and (user_id = auth.uid() or public.is_officer()));
create policy insight_likes_select on public.insight_likes for select to authenticated using (public.is_approved());
create policy insight_likes_insert on public.insight_likes for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy insight_likes_delete on public.insight_likes for delete to authenticated using (public.is_approved() and user_id = auth.uid());
create policy insight_bookmarks_select on public.insight_bookmarks for select to authenticated using (public.is_approved() and user_id = auth.uid());
create policy insight_bookmarks_insert on public.insight_bookmarks for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy insight_bookmarks_delete on public.insight_bookmarks for delete to authenticated using (public.is_approved() and user_id = auth.uid());
commit;
-- [R] 되돌리기: 프런트 먼저 되돌리고 신규 테이블 데이터 백업 후 관리자만 실행.
-- drop table public.insight_bookmarks, public.insight_likes, public.insight_comments, public.insight_posts;
