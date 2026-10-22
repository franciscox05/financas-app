-- Categorias dedicadas para dinheiro emprestado/devolvido (a pedido do Francisco):
-- antes caíam em "Outros Gastos"/"Outros Ganhos", misturadas com tudo o resto. Separar
-- permite ver de relance quanto se emprestou/recebeu num mês, no Balanço por categoria.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.accounts (user_id, name, type) values
    (new.id, 'Conta à Ordem', 'cash'),
    (new.id, 'XTB', 'investment'),
    (new.id, 'Trade Republic', 'investment');

  insert into public.categories (user_id, name, type) values
    (new.id, 'Salário', 'income'),
    (new.id, 'Bolsa de Estudo', 'income'),
    (new.id, 'Família/Mesada', 'income'),
    (new.id, 'Prendas', 'income'),
    (new.id, 'Biscates', 'income'),
    (new.id, 'Devoluções', 'income'),
    (new.id, 'Outros Ganhos', 'income'),
    (new.id, 'Alimentação', 'expense'),
    (new.id, 'Transporte', 'expense'),
    (new.id, 'Casa', 'expense'),
    (new.id, 'Lazer', 'expense'),
    (new.id, 'Saúde', 'expense'),
    (new.id, 'Empréstimos', 'expense'),
    (new.id, 'Outros Gastos', 'expense');

  return new;
end;
$$;

-- Backfill: adiciona as categorias novas aos utilizadores já existentes, sem duplicar.
insert into public.categories (user_id, name, type)
select u.id, c.name, c.type
from auth.users u
cross join (values ('Empréstimos', 'expense'), ('Devoluções', 'income')) as c(name, type)
where not exists (
  select 1 from public.categories existing
  where existing.user_id = u.id and existing.name = c.name and existing.type = c.type
);
