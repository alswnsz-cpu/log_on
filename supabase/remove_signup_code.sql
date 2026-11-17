-- 가입 코드 검사 제거. 2026-11-17 Supabase에서 실행 완료

CREATE OR REPLACE FUNCTION public.validate_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  user_name     text;
  user_login    text;
  user_phone    text;
  meta          jsonb := new.raw_user_meta_data;
begin
  user_name  := btrim(coalesce(meta ->> 'name', ''));
  user_login := lower(btrim(coalesce(meta ->> 'username', '')));
  user_phone := btrim(coalesce(meta ->> 'phone', ''));

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
$function$;
