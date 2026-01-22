-- Consumables are tracked for QOH/reorder but excluded from valuation.
alter table if exists parts
  add column if not exists is_consumable boolean not null default false;

alter table if exists parts
  add column if not exists include_in_valuation boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parts_consumable_not_valued_chk'
  ) then
    alter table public.parts
      add constraint parts_consumable_not_valued_chk
      check (not (is_consumable and include_in_valuation));
  end if;
end $$;
