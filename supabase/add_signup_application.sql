-- 추가용 SQL: 가입 신청서 (schema.sql, fix_username_login.sql 실행 후 이것을 실행)
-- 신청서는 별도 테이블에 저장하고, 임원진과 작성한 본인만 읽을 수 있다.
-- 클라이언트는 직접 쓸 수 없다. 가입 트리거(handle_new_user)가 가입 시점에만 넣는다.
-- 아래 [1] → [2] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 신청서 테이블 + 권한 (RLS)
-- ============================================================
create table public.signup_applications (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  student_no     text     not null check (student_no ~ '^[0-9]{4,12}$'),
  age            smallint not null check (age between 14 and 99),
  source         text check (source is null or char_length(source) <= 100),
  certifications text check (certifications is null or char_length(certifications) <= 200),
  interests      text[]   not null default '{}'
                 check (interests <@ array['transport', 'warehouse', 'scm', 'international', 'it', 'etc']::text[]),
  interest_other text check (interest_other is null or char_length(interest_other) <= 100),
  motivation     text     not null check (char_length(motivation) between 1 and 500),
  introduction   text     not null check (char_length(introduction) between 1 and 1000),
  created_at     timestamptz not null default now()
);

alter table public.signup_applications enable row level security;

-- 읽기만 허용한다. 쓰기(insert/update/delete)는 아무에게도 주지 않는다.
revoke all on public.signup_applications from public, anon, authenticated;
grant select on public.signup_applications to authenticated;

create policy signup_applications_select on public.signup_applications
  for select to authenticated
  using (user_id = auth.uid() or public.is_officer());

-- ============================================================
-- [2] 가입 트리거 교체: 신청서 필수 항목 검사 + 신청서 저장
-- ============================================================
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
  meta          jsonb := new.raw_user_meta_data;
begin
  select value into expected_code from public.app_settings where key = 'signup_code';
  given_code := btrim(coalesce(meta ->> 'invite_code', ''));
  user_name  := btrim(coalesce(meta ->> 'name', ''));
  user_login := lower(btrim(coalesce(meta ->> 'username', '')));
  user_phone := btrim(coalesce(meta ->> 'phone', ''));

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

  -- 가입 신청서 필수 항목
  if btrim(coalesce(meta ->> 'student_no', '')) !~ '^[0-9]{4,12}$' then
    raise exception '학번은 숫자 4~12자리로 입력해 주세요.';
  end if;
  if btrim(coalesce(meta ->> 'age', '')) !~ '^[0-9]{2}$' or (meta ->> 'age')::int not between 14 and 99 then
    raise exception '나이는 14~99 사이 숫자로 입력해 주세요.';
  end if;
  if char_length(btrim(coalesce(meta ->> 'motivation', ''))) not between 1 and 500 then
    raise exception '가입 동기는 1~500자로 입력해 주세요.';
  end if;
  if char_length(btrim(coalesce(meta ->> 'introduction', ''))) not between 1 and 1000 then
    raise exception '자기소개는 1~1000자로 입력해 주세요.';
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
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (id, name, username, phone, role, status)
  values (
    new.id,
    btrim(meta ->> 'name'),
    nullif(lower(btrim(coalesce(meta ->> 'username', ''))), ''),
    nullif(btrim(coalesce(meta ->> 'phone', '')), ''),
    'member',
    'pending'
  );

  insert into public.signup_applications
    (user_id, student_no, age, source, certifications, interests, interest_other, motivation, introduction)
  values (
    new.id,
    btrim(meta ->> 'student_no'),
    (btrim(meta ->> 'age'))::smallint,
    nullif(btrim(coalesce(meta ->> 'source', '')), ''),
    nullif(btrim(coalesce(meta ->> 'certifications', '')), ''),
    coalesce(
      array(
        select jsonb_array_elements_text(
          case when jsonb_typeof(meta -> 'interests') = 'array' then meta -> 'interests' else '[]'::jsonb end
        )
      ),
      '{}'
    ),
    nullif(btrim(coalesce(meta ->> 'interest_other', '')), ''),
    btrim(meta ->> 'motivation'),
    btrim(meta ->> 'introduction')
  );

  return new;
end;
$$;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 신청서 없이 가입하던 상태로 복구)
-- ============================================================
-- 1) 가입 트리거를 fix_username_login.sql 의 3번 구간 함수로 되돌린다.
--    (fix_username_login.sql 의 "create or replace function public.validate_signup()" 와
--     "create or replace function public.handle_new_user()" 두 블록을 다시 실행)
-- 2) drop table public.signup_applications;
