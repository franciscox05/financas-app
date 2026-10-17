-- Data limite opcional numa dívida, para lembretes de dívidas atrasadas.
alter table public.debts add column due_on date;
