-- Payments immutable except voiding: trigger and function

drop trigger if exists trg_enforce_payments_void_only on public.payments;

create or replace function public.enforce_payments_void_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block any updates after already voided
  if old.voided_at is not null then
    raise exception 'Voided payments are immutable.';
  end if;

  -- Block any non-void updates
  if new.voided_at is null then
    raise exception 'Payments are immutable; only voiding is allowed.';
  end if;

  -- Void transition: only voided_at and void_reason may change
  if new.amount           is distinct from old.amount
     or new.method        is distinct from old.method
     or new.reference     is distinct from old.reference
     or new.notes         is distinct from old.notes
     or new.order_type    is distinct from old.order_type
     or new.order_id      is distinct from old.order_id
     or new.created_at    is distinct from old.created_at
     or new.id            is distinct from old.id then
    raise exception 'Only voided_at and void_reason may change when voiding.';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_payments_void_only
before update on public.payments
for each row
execute function public.enforce_payments_void_only();
