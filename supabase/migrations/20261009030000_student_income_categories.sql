-- Categorias de rendimento mais realistas para quem ainda não trabalha
-- (bolsas, família, prendas, biscates), mantendo Salário/Outros Ganhos para
-- quando o utilizador entrar no mercado de trabalho.

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
    (new.id, 'Outros Ganhos', 'income'),
    (new.id, 'Alimentação', 'expense'),
    (new.id, 'Transporte', 'expense'),
    (new.id, 'Casa', 'expense'),
    (new.id, 'Lazer', 'expense'),
    (new.id, 'Saúde', 'expense'),
    (new.id, 'Outros Gastos', 'expense');

  return new;
end;
$$;

-- Backfill: adiciona as categorias novas aos utilizadores já existentes,
-- sem duplicar nem tocar nas categorias que já tenham.
insert into public.categories (user_id, name, type)
select u.id, c.name, 'income'
from auth.users u
cross join (values ('Bolsa de Estudo'), ('Família/Mesada'), ('Prendas'), ('Biscates')) as c(name)
where not exists (
  select 1 from public.categories existing
  where existing.user_id = u.id and existing.name = c.name and existing.type = 'income'
);
