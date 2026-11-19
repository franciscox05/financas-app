-- Empréstimos a amigos e devoluções deixam de contar como gasto e ganho do mês:
-- emprestar não é consumo e receber de volta não é rendimento, e contá-los
-- inflacionava os dois lados. A app passa a mostrá-los à parte ("emprestaste X,
-- recebeste Y"). Mesmo padrão de `is_savings` (20261010000000): uma flag por
-- categoria, que o utilizador pode ligar e desligar em Gestão.
-- Só acrescenta uma coluna; não altera linhas existentes além do backfill abaixo.

alter table public.categories
  add column is_lending boolean not null default false;

-- Backfill: as categorias que a app já usa por defeito para devoluções
-- (src/lib/repaymentInput.js: 'Empréstimos' e 'Devoluções').
update public.categories
   set is_lending = true
 where name in ('Empréstimos', 'Devoluções');
