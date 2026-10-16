-- Approving in the conversation (spec §6): in assistants Homing has checked
-- keep the model from pressing it, the person decides on a card in the
-- conversation. The decision arrives over the assistant's own connection, so
-- it records which assistant's card it came through. Null means Homing's own
-- page.

alter table proposals add column decided_in text;

drop trigger check_decision on proposals;
create trigger check_decision
before update of state, decided_in on proposals
for each row execute function check_decision();

grant update (decided_in) on proposals to homing_app;
