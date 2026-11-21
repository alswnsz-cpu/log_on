-- LOG:ON 4단계: 앨범 좋아요 및 댓글
-- 운영 DB 적용 전 관리자 검토 필요

begin;

-- 1. 앨범 좋아요
create table public.album_likes (
  album_id uuid not null
    references public.albums(id) on delete cascade,
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

-- 2. 앨범 댓글
create table public.album_comments (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null
    references public.albums(id) on delete cascade,
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  content text not null
    check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index album_comments_album_idx
on public.album_comments(album_id, created_at);

-- 3. RLS 활성화
alter table public.album_likes
enable row level security;

alter table public.album_comments
enable row level security;

revoke all on public.album_likes,
public.album_comments
from public, anon, authenticated;

grant select, insert, delete
on public.album_likes to authenticated;

grant select, insert, delete
on public.album_comments to authenticated;

grant update (content)
on public.album_comments to authenticated;

-- 4. 좋아요 권한
create policy album_likes_select
on public.album_likes
for select to authenticated
using (public.is_approved());

create policy album_likes_insert
on public.album_likes
for insert to authenticated
with check (
  public.is_approved()
  and user_id = auth.uid()
);

create policy album_likes_delete
on public.album_likes
for delete to authenticated
using (
  public.is_approved()
  and user_id = auth.uid()
);

-- 5. 댓글 권한
create policy album_comments_select
on public.album_comments
for select to authenticated
using (public.is_approved());

create policy album_comments_insert
on public.album_comments
for insert to authenticated
with check (
  public.is_approved()
  and user_id = auth.uid()
);

create policy album_comments_update
on public.album_comments
for update to authenticated
using (
  public.is_approved()
  and user_id = auth.uid()
)
with check (
  public.is_approved()
  and user_id = auth.uid()
);

create policy album_comments_delete
on public.album_comments
for delete to authenticated
using (
  public.is_approved()
  and (
    user_id = auth.uid()
    or public.is_officer()
  )
);

commit;