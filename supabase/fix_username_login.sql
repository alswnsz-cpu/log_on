-- 수정용 SQL: 아이디 로그인 + 선택 전화번호 (schema.sql을 이미 실행한 DB에서 이것만 실행)
-- 아이디는 앱에서 가짜 이메일(아이디@내부도메인)로 바뀌어 Supabase Auth에 저장된다.
-- 기존 이메일 계정은 username 이 비어 있는 채로 그대로 동작한다.

-- 1) 컬럼 추가
alter table public.profiles
  add column username text,
  add column phone    text;

alter table public.profiles
  add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9]{4,20}$'),
  add constraint profiles_phone_format    check (phone is null or phone ~ '^[0-9]{9,11}$');

-- 아이디는 대소문자 구분 없이 중복 불가 (저장 시 항상 소문자)
create unique index profiles_username_key on public.profiles (lower(username));

-- 2) 가입 검증: 아이디 형식·중복, 전화번호 형식 추가
create or replace function public.validate_signup()
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

create or replace function public.handle_new_user()
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

-- 3) 아이디 중복 확인 (로그인 전 가입 화면에서 호출)
create or replace function public.username_available(p_username text)
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

-- 4) 전화번호·아이디 열람 제한
--    profiles 의 username/phone 컬럼은 클라이언트(authenticated)에 직접 주지 않고,
--    본인 또는 임원진에게만 행이 보이는 뷰로만 읽게 한다. 다른 부원은 못 본다.
revoke select on public.profiles from authenticated;
grant  select (id, name, role, status, created_at) on public.profiles to authenticated;

create or replace view public.profile_private as
  select id, username, phone
  from public.profiles
  where id = auth.uid() or public.is_officer();

revoke all on public.profile_private from public, anon;
grant select on public.profile_private to authenticated;
