-- A pedido do Francisco: investimentos (ex. Conta à Ordem -> XTB) são dinheiro
-- que considera "gasto" no mês (não pretende mexer durante anos), mas também
-- quer que o saldo da conta destino (XTB) atualize sozinho, sem duas entradas
-- manuais a desalinhar. Uma transferência normal já atualiza as duas contas
-- (ver `accountBalance.balanceAt`) mas nunca conta como Gasto/Ganho — por
-- design, para transferências neutras (ex. mover entre duas contas à ordem).
-- Esta flag deixa UMA transferência específica contar como Gasto do mês,
-- com categoria, sem criar uma segunda transação que possa desalinhar.

alter table public.transfers
  add column category_id uuid references public.categories (id) on delete set null,
  add column counts_as_expense boolean not null default false,
  add constraint transfers_expense_needs_category
    check (not counts_as_expense or category_id is not null);
