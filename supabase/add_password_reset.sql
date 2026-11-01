-- 추가용 SQL: 내 정보 수정 + 비밀번호 재설정(임원진이 대신 처리)
-- 흐름: 부원이 로그인 화면에서 "비밀번호를 잊었어요" → 재설정 요청 → 임원진이 본인 확인 후 임시 비밀번호 설정
-- 비밀번호는 암호화(bcrypt)해서 auth.users 에 직접 쓴다. 평문은 어디에도 남기지 않는다.
-- 아래 [1] → [2] → [3] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 재설정 요청 테이블 + 권한 (RLS)
--     클라이언트는 임원진만 읽고 지울 수 있다. 요청은 아래 함수로만 만든다.
-- ============================================================
create table public.password_reset_requests (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now()
);

alter table public.password_reset_requests enable row level security;

revoke all on public.password_reset_requests from public, anon, authenticated;
grant select, delete on public.password_reset_requests to authenticated;

create policy password_reset_select on public.password_reset_requests
  for select to authenticated using (public.is_officer());

create policy password_reset_delete on public.password_reset_requests
  for delete to authenticated using (public.is_officer());

-- ============================================================
-- [2] 함수: 재설정 요청(로그인 전에도 호출) + 내 정보 수정
-- ============================================================
-- 아이디가 없거나 승인되지 않은 계정이어도 같은 응답(오류 없음)을 돌려 아이디 존재 여부를 알리지 않는다.
create or replace function public.request_password_reset(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  select id into uid
  from public.profiles
  where lower(username) = lower(btrim(coalesce(p_username, ''))) and status = 'approved';

  if uid is not null then
    insert into public.password_reset_requests (user_id)
    values (uid)
    on conflict (user_id) do update set requested_at = now();
  end if;
end;
$$;

create or replace function public.update_my_profile(p_name text, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_name  text := btrim(coalesce(p_name, ''));
  new_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if char_length(new_name) not between 1 and 30 then
    raise exception '이름은 1~30자로 입력해 주세요.';
  end if;
  if new_phone is not null and new_phone !~ '^[0-9]{9,11}$' then
    raise exception '전화번호는 숫자 9~11자리로 입력해 주세요.';
  end if;

  update public.profiles
  set name = new_name, phone = new_phone
  where id = auth.uid() and status = 'approved';

  if not found then
    raise exception '승인된 부원만 수정할 수 있습니다.';
  end if;
end;
$$;

revoke execute on function public.request_password_reset(text) from public;
revoke execute on function public.update_my_profile(text, text) from public, anon;
grant  execute on function public.request_password_reset(text) to anon, authenticated;
grant  execute on function public.update_my_profile(text, text) to authenticated;

-- ============================================================
-- [3] 함수: 임원진이 임시 비밀번호 설정
--     bcrypt 로 암호화해서 저장하고, 그 계정의 기존 로그인(세션)을 모두 풀어 준다.
-- ============================================================
create or replace function public.reset_member_password(p_user uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_officer() then
    raise exception '임원진만 비밀번호를 재설정할 수 있습니다.';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 자신의 비밀번호는 내 정보에서 바꿔 주세요.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'approved') then
    raise exception '승인된 부원만 재설정할 수 있습니다.';
  end if;
  if char_length(coalesce(p_password, '')) < 8 or char_length(p_password) > 72 then
    raise exception '임시 비밀번호는 8~72자로 입력해 주세요.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = p_user;

  delete from auth.sessions where user_id = p_user;
  delete from public.password_reset_requests where user_id = p_user;
end;
$$;

revoke execute on function public.reset_member_password(uuid, text) from public, anon;
grant  execute on function public.reset_member_password(uuid, text) to authenticated;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- drop function public.reset_member_password(uuid, text);
-- drop function public.update_my_profile(text, text);
-- drop function public.request_password_reset(text);
-- drop table public.password_reset_requests;
