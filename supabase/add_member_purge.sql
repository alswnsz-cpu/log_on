-- 추가용 SQL: 탈퇴·거절된 계정을 임원진이 완전히 삭제하기
--   · purge_member(p_user): 임원진만 호출 가능. 탈퇴했거나 거절된 일반 부원 계정만 지울 수 있다.
--   · 계정(auth.users)을 지우면 함께 지워진다: 프로필(이름·아이디·전화번호), 가입 신청서, 시간표, 입력 완료 기록,
--     그 사람이 남긴 의견, 탈퇴 신청, 비밀번호 재설정 요청. 같은 아이디로 다시 가입할 수 있게 된다.
--   · 안건·결론·공식 일정을 만든 기록이 있는 계정은 DB가 막아서 지워지지 않는다. (임원진이었다가 부원이 된 경우)
-- 되돌릴 수 없으니 화면에서는 이름을 직접 입력해야 지워지게 한다.

create or replace function public.purge_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
begin
  if not public.is_officer() then
    raise exception '임원진만 완전 삭제할 수 있습니다.';
  end if;
  select * into target from public.profiles where id = p_user;
  if not found then
    raise exception '삭제할 대상을 찾을 수 없습니다.';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 자신은 삭제할 수 없습니다.';
  end if;
  if target.status not in ('removed', 'rejected') then
    raise exception '탈퇴했거나 거절된 계정만 완전 삭제할 수 있습니다.';
  end if;
  if target.role <> 'member' then
    raise exception '임원진 권한이 있는 계정은 삭제할 수 없습니다. 먼저 부원으로 변경해 주세요.';
  end if;

  -- 개인 일정은 먼저 지운다 (프로필을 가리키는 연결이라 남아 있으면 삭제가 막힌다)
  delete from public.events where created_by = p_user and is_club = false;

  begin
    delete from auth.users where id = p_user;
  exception when foreign_key_violation then
    raise exception '이 사람이 만든 안건·결론·공식 일정이 남아 있어 삭제할 수 없습니다.';
  end;
end;
$$;

revoke execute on function public.purge_member(uuid) from public, anon;
grant  execute on function public.purge_member(uuid) to authenticated;

-- ============================================================
-- [R] 되돌리기 (함수만 없앤다. 이미 지운 계정은 복구할 수 없다)
-- ============================================================
-- drop function public.purge_member(uuid);
