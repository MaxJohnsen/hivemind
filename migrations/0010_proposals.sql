-- Proposals (spec §6): an exact change, waiting for a person to decide.
--
-- An assistant proposes; only a person decides. So far a person decides
-- what their own assistant proposed, so a proposal is on their private side
-- of its space, where nobody else sees it. It never changes once made,
-- except for its decision, which that person makes editing directly, never
-- through an assistant. Deciding doesn't change anything by itself: Homing
-- makes the change as the person, under the same checks as a direct edit.

create table proposals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id),
  -- The person it was proposed to, who decides it.
  private_to uuid not null references people (id),
  -- What it would do.
  action text not null check (action in ('add rule', 'change rule', 'remove rule')),
  -- What it changes, if it changes something that exists, such as a rule.
  item_id uuid references content (id),
  -- The exact change: for a new rule its kind, text, side and reach, and
  -- for a changed one its new text.
  change jsonb not null check (jsonb_typeof(change) = 'object'),
  -- The assistant that proposed it.
  agent text default current_agent(),
  state text not null default 'open' check (state in ('open', 'approved', 'rejected')),
  created_at timestamptz not null default clock_timestamp(),
  -- An open proposal nobody decides expires, and nothing changes.
  expires_at timestamptz not null default clock_timestamp() + interval '7 days',
  decided_by uuid references people (id),
  decided_at timestamptz
);

create index proposals_open on proposals (private_to, space_id) where state = 'open';

-- Only the person a proposal is for decides it, directly, and only once,
-- before it expires. Who decided and when come from the transaction.
create function check_decision() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if not direct_edit() or old.private_to is distinct from current_person_id() then
    raise exception 'only the person it was proposed to decides it, never an assistant' using errcode = 'insufficient_privilege';
  end if;
  if old.state <> 'open' or new.state not in ('approved', 'rejected') then
    raise exception 'that proposal was already decided' using errcode = 'check_violation';
  end if;
  if old.expires_at <= clock_timestamp() then
    raise exception 'that proposal has expired' using errcode = 'check_violation';
  end if;
  new.decided_by := current_person_id();
  new.decided_at := clock_timestamp();
  return new;
end
$$;

create trigger check_decision
before update of state on proposals
for each row execute function check_decision();

alter table proposals enable row level security;

create policy own on proposals
using (private_to = current_person_id() and space_id in (select accessible_spaces()))
with check (private_to = current_person_id() and space_id in (select accessible_spaces()));

-- A proposal is made open, and only its state ever changes.
grant select, insert (space_id, private_to, action, item_id, change) on proposals to homing_app;
grant update (state) on proposals to homing_app;
