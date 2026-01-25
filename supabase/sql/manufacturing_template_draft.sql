begin;

alter table public.manufacturing_templates
  add column if not exists draft_json jsonb;

commit;
