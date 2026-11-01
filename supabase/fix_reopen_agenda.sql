-- 확정 안건 "다시 논의하기" 지원용 수정 (이미 schema.sql 을 실행한 DB에서 한 번 실행)

-- 1) 안건 상태 변경 보호 트리거
create or replace function public.guard_agenda_status()
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

drop trigger if exists agendas_guard_status on public.agendas;
create trigger agendas_guard_status
  before update on public.agendas
  for each row execute function public.guard_agenda_status();

-- 2) 결론 저장 시 확정자·일시를 서버에서 기록
create or replace function public.stamp_decision()
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

drop trigger if exists decisions_stamp on public.decisions;
create trigger decisions_stamp
  before insert or update on public.decisions
  for each row execute function public.stamp_decision();

revoke execute on function public.guard_agenda_status() from public, anon, authenticated;
revoke execute on function public.stamp_decision()      from public, anon, authenticated;

-- 3) 안건 상태 변경이 다른 사용자 화면에 바로 반영되도록 Realtime 등록
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agendas') then
    alter publication supabase_realtime add table public.agendas;
  end if;
end $$;
