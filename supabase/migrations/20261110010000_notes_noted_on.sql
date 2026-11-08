-- Notas do Perfil: data própria, escolhida pelo utilizador.
--
-- O calendário de notas (NotesCalendar.jsx, sessão de 30/10) agrupava por
-- `created_at` porque não havia mais nada, e por isso o composer só podia
-- aparecer no dia de hoje — abrir qualquer outro dia mostrava "Sem notas neste
-- dia" e nenhuma caixa de escrita. Era a limitação deixada em aberto nessa
-- sessão; o Francisco reportou-a como bug ("não consigo escrever nem guardar").
--
-- `noted_on` é a data A QUE a nota se refere, separada de `created_at` (quando
-- foi escrita, que se mantém para ordenar e auditar). Resolve ainda um segundo
-- problema silencioso: agrupar por `created_at` em JS usava UTC, por isso uma
-- nota escrita depois da meia-noite em Lisboa caía no dia anterior.
alter table public.notes
  add column if not exists noted_on date;

-- Backfill na data local de Lisboa, não em UTC — é o dia que a pessoa viu no
-- relógio quando escreveu, e o que o calendário vai mostrar.
update public.notes
   set noted_on = (created_at at time zone 'Europe/Lisbon')::date
 where noted_on is null;

alter table public.notes
  alter column noted_on set default current_date,
  alter column noted_on set not null;

create index if not exists notes_user_noted_on_idx on public.notes (user_id, noted_on desc);
