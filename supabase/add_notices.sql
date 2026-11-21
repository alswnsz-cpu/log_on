-- LOG:ON 공식 공지사항 및 회원별 확인 기록
-- 기존 테이블과 권한 함수는 변경하지 않는다. 운영 DB 적용은 관리자만 수행.
begin;
create table public.club_notices (
  id uuid primary key default gen_random_uuid(),
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  category text not null default '일반' check (category in ('일반','활동','일정','모집','긴급')),
  pinned boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, revision)
);
create table public.club_notice_reads (
  notice_id uuid not null,
  revision integer not null,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id),
  foreign key (notice_id, revision) references public.club_notices(id, revision) on delete cascade
);
create index club_notices_order_idx on public.club_notices(pinned desc, created_at desc);
create index club_notice_reads_user_idx on public.club_notice_reads(user_id);
-- 제목/본문 변경 시 이전 확인 기록을 지우고 버전을 올린다.
-- 복합 FK가 이전 버전의 늦은 확인 요청도 차단한다.
create function public.club_notice_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.title is distinct from old.title or new.body is distinct from old.body then
    delete from public.club_notice_reads where notice_id = old.id;
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  return new;
end;
$$;
revoke all on function public.club_notice_before_update() from public, anon, authenticated;
create trigger club_notice_update before update on public.club_notices
for each row execute function public.club_notice_before_update();
alter table public.club_notices enable row level security;
alter table public.club_notice_reads enable row level security;
revoke all on public.club_notices, public.club_notice_reads from public, anon, authenticated;
grant select, delete on public.club_notices to authenticated;
grant insert (title, body, category, pinned), update (title, body, category, pinned) on public.club_notices to authenticated;
grant select on public.club_notice_reads to authenticated;
grant insert (notice_id, revision) on public.club_notice_reads to authenticated;
create policy club_notices_select on public.club_notices for select to authenticated using (public.is_approved());
create policy club_notices_insert on public.club_notices for insert to authenticated with check (public.is_officer() and author_id = auth.uid());
create policy club_notices_update on public.club_notices for update to authenticated using (public.is_officer()) with check (public.is_officer());
create policy club_notices_delete on public.club_notices for delete to authenticated using (public.is_officer());
create policy club_notice_reads_select on public.club_notice_reads for select to authenticated using (public.is_approved() and (user_id = auth.uid() or public.is_officer()));
create policy club_notice_reads_insert on public.club_notice_reads for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
commit;
-- 관리자용 롤백 (신규 공지와 확인 기록이 삭제되므로 먼저 백업할 것)
-- begin;
-- drop table public.club_notice_reads;
-- drop trigger club_notice_update on public.club_notices;
-- drop table public.club_notices;
-- drop function public.club_notice_before_update();
-- commit;
