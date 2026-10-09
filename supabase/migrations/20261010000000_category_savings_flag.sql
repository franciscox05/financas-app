-- Distingue categorias de "poupança/investimento" das de gasto real, para o
-- Balanço poder mostrar quanto foi guardado sem o misturar nos gastos do
-- dia a dia (pedido do Francisco, refletindo como ele próprio separava
-- "Investimentos" à mão nas notas antigas).

alter table public.categories
  add column is_savings boolean not null default false;
