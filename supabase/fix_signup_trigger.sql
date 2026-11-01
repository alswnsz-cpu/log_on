-- 수정용 SQL: 가입 트리거 교체 (schema.sql을 이미 실행한 DB에서 이것만 실행)
-- 원인: BEFORE INSERT 트리거에서 profiles를 넣어 auth.users 행이 생기기 전에 외래키가 실패했다.
-- 수정: BEFORE는 검증만(틀리면 예외), profiles 생성은 AFTER INSERT로 분리.

-- 1) 기존 트리거·함수 제거
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_validate on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.validate_signup();

-- 2) 검증 함수 (BEFORE INSERT)
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
begin
  select value into expected_code from public.app_settings where key = 'signup_code';
  given_code := btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  user_name  := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));

  if expected_code is null or expected_code = '' or given_code <> expected_code then
    raise exception '가입 코드가 올바르지 않습니다.';
  end if;

  if char_length(user_name) not between 1 and 30 then
    raise exception '이름은 1~30자로 입력해 주세요.';
  end if;

  return new;
end;
$$;

-- 3) 프로필 생성 함수 (AFTER INSERT)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role, status)
  values (new.id, btrim(new.raw_user_meta_data ->> 'name'), 'member', 'pending');
  return new;
end;
$$;

-- 4) 트리거 재생성
create trigger on_auth_user_validate
  before insert on auth.users
  for each row execute function public.validate_signup();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) 실행 권한 차단
revoke execute on function public.validate_signup()  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
