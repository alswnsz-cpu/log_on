-- 동아리 시간·토론 공유 시스템 스키마
-- Supabase 대시보드 > SQL Editor 에서 전체를 한 번 실행한다.
-- 권한은 화면이 아니라 이 파일의 RLS로 강제한다.

-- ============================================================
-- 1. 테이블
-- ============================================================

create table public.app_settings (
  key   text primary key,
  value text not null
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  username   text check (username is null or username ~ '^[a-z0-9]{4,20}$'),  -- 로그인 아이디(소문자). 기존 이메일 계정은 null
  phone      text check (phone is null or phone ~ '^[0-9]{9,11}$'),            -- 선택. 본인·임원진만 profile_private 뷰로 열람
  role       text not null default 'member'  check (role in ('member', 'officer')),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
-- 아이디는 대소문자 구분 없이 중복 불가
create unique index profiles_username_key on public.profiles (lower(username));

create table public.schedule_blocks (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('class', 'manual')),
  subject    text check (subject is null or char_length(subject) <= 50),
  day        smallint not null check (day between 0 and 4),            -- 0=월 ... 4=금
  start_min  smallint not null check (start_min between 540 and 1080 and start_min % 30 = 0),
  end_min    smallint not null check (end_min   between 540 and 1080 and end_min   % 30 = 0),
  semester   text check (semester is null or char_length(semester) <= 20),
  created_at timestamptz not null default now(),
  check (start_min < end_min)
);
create index schedule_blocks_user_idx on public.schedule_blocks (user_id);

create table public.agendas (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 100),
  description text check (description is null or char_length(description) <= 2000),
  status      text not null default 'discussing' check (status in ('discussing', 'decided')),
  created_by  uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.opinions (
  id         bigint generated always as identity primary key,
  agenda_id  bigint not null references public.agendas (id) on delete cascade,
  user_id    uuid   not null default auth.uid() references public.profiles (id) on delete cascade,
  stance     text   not null check (stance in ('agree', 'disagree', 'hold')),
  content    text   check (content is null or char_length(content) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agenda_id, user_id)
);

create table public.decisions (
  agenda_id  bigint primary key references public.agendas (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  decided_by uuid not null default auth.uid() references public.profiles (id),
  decided_at timestamptz not null default now()
);

-- ============================================================
-- 2. 권한 확인 함수 (RLS에서 profiles 재귀 조회를 피하려고 security definer)
-- ============================================================

create function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

create function public.is_officer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved' and role = 'officer'
  );
$$;

revoke execute on function public.is_approved() from public, anon;
revoke execute on function public.is_officer()  from public, anon;
grant  execute on function public.is_approved() to authenticated;
grant  execute on function public.is_officer()  to authenticated;

-- ============================================================
-- 3. 트리거
-- ============================================================

-- 3-1. 가입 트리거 (2단계 구성)
--   BEFORE INSERT: 가입 코드·이름 검증. 틀리면 예외를 던져 auth.users 생성을 막는다.
--   AFTER  INSERT: auth.users 행이 생긴 뒤에 profiles를 pending으로 생성한다.
--                  (BEFORE에서 넣으면 profiles.id 외래키가 아직 없는 행을 참조해 실패한다)
create function public.validate_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_code text;
  given_code    text;
  user_name     text;
  user_login    text;
  user_phone    text;
begin
  select value into expected_code from public.app_settings where key = 'signup_code';
  given_code := btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  user_name  := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  user_login := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  user_phone := btrim(coalesce(new.raw_user_meta_data ->> 'phone', ''));

  if expected_code is null or expected_code = '' or given_code <> expected_code then
    raise exception '가입 코드가 올바르지 않습니다.';
  end if;

  if char_length(user_name) not between 1 and 30 then
    raise exception '이름은 1~30자로 입력해 주세요.';
  end if;

  if user_login <> '' then
    if user_login !~ '^[a-z0-9]{4,20}$' then
      raise exception '아이디는 영문·숫자 4~20자로 입력해 주세요.';
    end if;
    if exists (select 1 from public.profiles where lower(username) = user_login) then
      raise exception '이미 사용 중인 아이디입니다.';
    end if;
  end if;

  if user_phone <> '' and user_phone !~ '^[0-9]{9,11}$' then
    raise exception '전화번호 형식이 올바르지 않습니다.';
  end if;

  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, username, phone, role, status)
  values (
    new.id,
    btrim(new.raw_user_meta_data ->> 'name'),
    nullif(lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', ''))), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    'member',
    'pending'
  );
  return new;
end;
$$;

-- 아이디 중복 확인 (로그인 전 가입 화면에서 호출)
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(btrim(p_username))
  );
$$;

revoke execute on function public.username_available(text) from public;
grant  execute on function public.username_available(text) to anon, authenticated;

create trigger on_auth_user_validate
  before insert on auth.users
  for each row execute function public.validate_signup();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3-2. 임원진 보호: 승인된 임원진이 0명이 되는 변경은 거부
create function public.protect_last_officer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
begin
  select count(*) into remaining
  from public.profiles
  where role = 'officer' and status = 'approved' and id <> new.id;

  if new.role = 'officer' and new.status = 'approved' then
    remaining := remaining + 1;
  end if;

  if remaining = 0 then
    raise exception '승인된 임원진이 최소 1명은 있어야 합니다.';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_last_officer
  before update on public.profiles
  for each row execute function public.protect_last_officer();

-- 3-3. 결론 저장/삭제 시 안건 상태 동기화
--      (다시 논의하기는 agendas.status 만 되돌리고 decisions 행은 "이전 결론"으로 남긴다)
create function public.sync_agenda_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.agendas set status = 'discussing' where id = old.agenda_id;
    return old;
  end if;
  update public.agendas set status = 'decided' where id = new.agenda_id;
  return new;
end;
$$;

create trigger decisions_sync_agenda
  after insert or update or delete on public.decisions
  for each row execute function public.sync_agenda_status();

-- 3-4. 의견 수정 시각 갱신
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger opinions_touch
  before update on public.opinions
  for each row execute function public.touch_updated_at();

-- 3-5. 안건 상태 변경 보호: 상태(토론 중/확정) 변경은 임원진만, 확정은 결론이 있을 때만
--      (화면·RLS 우회 방지용. SQL 편집기 등 authenticated 가 아닌 역할은 제한하지 않는다)
create function public.guard_agenda_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if coalesce(auth.role(), '') = 'authenticated' and not public.is_officer() then
      raise exception '안건 상태는 임원진만 변경할 수 있습니다.';
    end if;
    if new.status = 'decided'
       and not exists (select 1 from public.decisions where agenda_id = new.id) then
      raise exception '결론이 없는 안건은 확정할 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

create trigger agendas_guard_status
  before update on public.agendas
  for each row execute function public.guard_agenda_status();

-- 3-6. 결론 저장 시 확정자·일시를 서버에서 기록 (다시 논의 후 재확정하면 새 확정자로 교체)
create function public.stamp_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

create trigger decisions_stamp
  before insert or update on public.decisions
  for each row execute function public.stamp_decision();

revoke execute on function public.validate_signup()      from public, anon, authenticated;
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.protect_last_officer() from public, anon, authenticated;
revoke execute on function public.sync_agenda_status()   from public, anon, authenticated;
revoke execute on function public.touch_updated_at()     from public, anon, authenticated;
revoke execute on function public.guard_agenda_status()  from public, anon, authenticated;
revoke execute on function public.stamp_decision()       from public, anon, authenticated;

-- ============================================================
-- 4. 뷰: 타인에게는 "불가 시간"만 노출 (subject 제외)
--    뷰 소유자 권한으로 실행되며 승인된 사용자에게만 행이 보인다.
-- ============================================================

create view public.busy_blocks as
  select user_id, day, start_min, end_min
  from public.schedule_blocks
  where public.is_approved();

revoke all on public.busy_blocks from public, anon;
grant select on public.busy_blocks to authenticated;

-- ============================================================
-- 5. RLS
-- ============================================================

alter table public.app_settings   enable row level security;
alter table public.profiles       enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.agendas        enable row level security;
alter table public.opinions       enable row level security;
alter table public.decisions      enable row level security;

-- 테이블 권한: anon은 전부 차단, authenticated는 필요한 것만
revoke all on public.app_settings, public.profiles, public.schedule_blocks,
              public.agendas, public.opinions, public.decisions from anon, authenticated;

-- app_settings: 정책 없음 + 권한 없음 = 클라이언트에서 읽기/쓰기 불가 (SQL 편집기에서만 수정)

-- profiles
-- username/phone 은 컬럼 권한을 주지 않는다. 본인·임원진에게만 행이 보이는 profile_private 뷰로만 읽는다.
grant select (id, name, role, status, created_at) on public.profiles to authenticated;
grant update (role, status) on public.profiles to authenticated;  -- 컬럼 단위로 제한

create view public.profile_private as
  select id, username, phone
  from public.profiles
  where id = auth.uid() or public.is_officer();

revoke all on public.profile_private from public, anon;
grant select on public.profile_private to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or (public.is_approved() and status = 'approved'));

-- 임원진은 승인 대기·거절 포함 전체 목록을 볼 수 있다 (Admin 화면용)
create policy profiles_select_officer on public.profiles
  for select to authenticated
  using (public.is_officer());

create policy profiles_update_officer on public.profiles
  for update to authenticated
  using (public.is_officer())
  with check (public.is_officer());

-- schedule_blocks: 본인만
grant select, insert, update, delete on public.schedule_blocks to authenticated;
grant usage, select on sequence public.schedule_blocks_id_seq to authenticated;

create policy schedule_select_own on public.schedule_blocks
  for select to authenticated using (user_id = auth.uid() and public.is_approved());
create policy schedule_insert_own on public.schedule_blocks
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
create policy schedule_update_own on public.schedule_blocks
  for update to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());
create policy schedule_delete_own on public.schedule_blocks
  for delete to authenticated using (user_id = auth.uid() and public.is_approved());

-- agendas: 승인된 사용자 읽기, 임원진만 쓰기
grant select, insert, update, delete on public.agendas to authenticated;
grant usage, select on sequence public.agendas_id_seq to authenticated;

create policy agendas_select on public.agendas
  for select to authenticated using (public.is_approved());
create policy agendas_insert on public.agendas
  for insert to authenticated with check (public.is_officer() and created_by = auth.uid());
create policy agendas_update on public.agendas
  for update to authenticated using (public.is_officer()) with check (public.is_officer());
create policy agendas_delete on public.agendas
  for delete to authenticated using (public.is_officer());

-- opinions: 승인된 사용자 읽기, 본인 것만 쓰기, 안건이 토론 중일 때만
grant select, insert, update, delete on public.opinions to authenticated;
grant usage, select on sequence public.opinions_id_seq to authenticated;

create policy opinions_select on public.opinions
  for select to authenticated using (public.is_approved());
create policy opinions_insert on public.opinions
  for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_approved()
    and exists (select 1 from public.agendas a where a.id = agenda_id and a.status = 'discussing')
  );
create policy opinions_update on public.opinions
  for update to authenticated
  using (
    user_id = auth.uid() and public.is_approved()
    and exists (select 1 from public.agendas a where a.id = agenda_id and a.status = 'discussing')
  )
  with check (
    user_id = auth.uid() and public.is_approved()
    and exists (select 1 from public.agendas a where a.id = agenda_id and a.status = 'discussing')
  );
create policy opinions_delete on public.opinions
  for delete to authenticated
  using (
    user_id = auth.uid() and public.is_approved()
    and exists (select 1 from public.agendas a where a.id = agenda_id and a.status = 'discussing')
  );

-- decisions: 승인된 사용자 읽기, 임원진만 쓰기
grant select, insert, update, delete on public.decisions to authenticated;

create policy decisions_select on public.decisions
  for select to authenticated using (public.is_approved());
create policy decisions_insert on public.decisions
  for insert to authenticated with check (public.is_officer() and decided_by = auth.uid());
create policy decisions_update on public.decisions
  for update to authenticated using (public.is_officer()) with check (public.is_officer());
create policy decisions_delete on public.decisions
  for delete to authenticated using (public.is_officer());

-- ============================================================
-- 6. Realtime (4단계에서 사용)
-- ============================================================

alter publication supabase_realtime add table public.opinions, public.decisions, public.agendas;

-- ============================================================
-- 7. 가입 코드 설정 (직접 값을 바꿔서 한 번 실행. 이 파일에는 실제 코드를 적지 않는다)
-- ============================================================
-- insert into public.app_settings (key, value) values ('signup_code', '여기에_원하는_가입코드')
--   on conflict (key) do update set value = excluded.value;
