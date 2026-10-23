-- Utilizadoras de demonstração para o vídeo de pitch (dados fictícios).
-- Sofia (demo@financasapp.com) é a protagonista; Rita (demo-rita@financasapp.com)
-- é uma amiga LIGADA à Sofia, para mostrar movimentos partilhados a aguardar confirmação.
-- Idempotente: apaga as duas e recria tudo, com a password atual da Sofia. Só na primeira
-- vez (sem Sofia na BD) é preciso trocar __DEMO_PASSWORD__.
-- Datas pensadas para "hoje" = 2026-10-23 (João e Miguel atrasados, sushi de ontem
-- dividido por 4 e ainda por confirmar do lado da Rita).
-- Sem telefone nas contas demo: um número real aqui apanharia pedidos de amizade alheios.
-- Corre como postgres: os triggers de guarda deixam passar (só bloqueiam o cliente).

do $$
declare
  sofia_email constant text := 'demo@financasapp.com';
  rita_email constant text := 'demo-rita@financasapp.com';
  old_ids uuid[];
  uid uuid := gen_random_uuid();
  rid uuid := gen_random_uuid();
  acc_ordem uuid; acc_poup uuid; acc_xtb uuid; acc_tr uuid; r_ordem uuid;
  c_salario uuid; c_devol uuid; c_alim uuid; c_transp uuid; c_casa uuid;
  c_lazer uuid; c_saude uuid; c_outros_gastos uuid; c_invest uuid;
  r_alim uuid; r_lazer uuid;
  f_rita uuid; f_joao uuid; f_miguel uuid; f_ines uuid; rf_sofia uuid;
  tx_jantar uuid; tx_rita uuid; tx_ines uuid; tx_sushi uuid;
  e_own uuid; e_mirror uuid;
  pw_hash text;
begin
  -- Reaproveita a password atual da Sofia (se já existir) para as duas contas — assim
  -- dá para repor os dados sem trocar __DEMO_PASSWORD__ nem mexer no .env.demo.
  select encrypted_password into pw_hash from auth.users where email = sofia_email;
  pw_hash := coalesce(pw_hash, extensions.crypt('__DEMO_PASSWORD__', extensions.gen_salt('bf')));

  -- Reset das duas contas (ledger primeiro: tem FKs para friends e transactions).
  select array_agg(id) into old_ids from auth.users where email in (sofia_email, rita_email);
  if old_ids is not null then
    delete from public.ledger_entries where user_id = any(old_ids);
    delete from public.friend_requests where from_user_id = any(old_ids);
    delete from public.friends where owner_id = any(old_ids);
    delete from public.debt_payments where user_id = any(old_ids);
    delete from public.debts where user_id = any(old_ids);
    delete from public.goals where user_id = any(old_ids);
    delete from public.notes where user_id = any(old_ids);
    delete from public.push_subscriptions where user_id = any(old_ids);
    delete from public.net_worth_snapshots where user_id = any(old_ids);
    delete from public.transactions where user_id = any(old_ids);
    delete from public.transfers where user_id = any(old_ids);
    delete from public.category_rules where user_id = any(old_ids);
    delete from public.accounts where user_id = any(old_ids);
    delete from public.categories where user_id = any(old_ids);
    delete from public.profiles where id = any(old_ids);
    delete from auth.identities where user_id = any(old_ids);
    delete from auth.users where id = any(old_ids);
  end if;

  -- O trigger on_auth_user_created cria profile, contas e categorias default.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
     sofia_email, pw_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Sofia Martins"}',
     '2026-07-01', now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', rid, 'authenticated', 'authenticated',
     rita_email, pw_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Rita Ferreira"}',
     '2026-07-10', now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now()
  from auth.users u where u.id in (uid, rid);

  -- --- Sofia: contas e categorias ---------------------------------------------
  select id into acc_ordem from public.accounts where user_id = uid and name = 'Conta à Ordem';
  select id into acc_xtb from public.accounts where user_id = uid and name = 'XTB';
  select id into acc_tr from public.accounts where user_id = uid and name = 'Trade Republic';
  insert into public.accounts (user_id, name, type, created_at)
    values (uid, 'Poupança', 'cash', '2026-07-01') returning id into acc_poup;

  select id into c_salario from public.categories where user_id = uid and name = 'Salário';
  select id into c_devol from public.categories where user_id = uid and name = 'Devoluções';
  select id into c_alim from public.categories where user_id = uid and name = 'Alimentação';
  select id into c_transp from public.categories where user_id = uid and name = 'Transporte';
  select id into c_casa from public.categories where user_id = uid and name = 'Casa';
  select id into c_lazer from public.categories where user_id = uid and name = 'Lazer';
  select id into c_saude from public.categories where user_id = uid and name = 'Saúde';
  select id into c_outros_gastos from public.categories where user_id = uid and name = 'Outros Gastos';
  insert into public.categories (user_id, name, type, is_savings)
    values (uid, 'Investimentos', 'expense', true) returning id into c_invest;

  -- Snapshots: created_at = data do snapshot, para as transações posteriores somarem por cima.
  insert into public.net_worth_snapshots (user_id, account_id, value, snapshot_date, created_at) values
    (uid, acc_ordem,  980.00, '2026-04-30', '2026-04-30 20:00'),
    (uid, acc_ordem, 1050.00, '2026-05-31', '2026-05-31 20:00'),
    (uid, acc_ordem, 1120.00, '2026-06-30', '2026-06-30 20:00'),
    (uid, acc_ordem, 1180.00, '2026-07-31', '2026-07-31 20:00'),
    (uid, acc_ordem, 1240.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_poup,  1900.00, '2026-04-30', '2026-04-30 20:00'),
    (uid, acc_poup,  2050.00, '2026-05-31', '2026-05-31 20:00'),
    (uid, acc_poup,  2200.00, '2026-06-30', '2026-06-30 20:00'),
    (uid, acc_poup,  2350.00, '2026-07-31', '2026-07-31 20:00'),
    (uid, acc_poup,  2500.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_poup,  2650.00, '2026-09-30', '2026-09-30 20:00'),
    (uid, acc_poup,  2800.00, '2026-10-13', '2026-10-13 20:00'),
    (uid, acc_xtb,   2600.00, '2026-04-30', '2026-04-30 20:00'),
    (uid, acc_xtb,   2750.00, '2026-05-31', '2026-05-31 20:00'),
    (uid, acc_xtb,   2900.00, '2026-06-30', '2026-06-30 20:00'),
    (uid, acc_xtb,   3100.00, '2026-07-31', '2026-07-31 20:00'),
    (uid, acc_xtb,   3240.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_xtb,   3480.00, '2026-09-30', '2026-09-30 20:00'),
    (uid, acc_xtb,   3725.00, '2026-10-13', '2026-10-13 20:00'),
    (uid, acc_tr,    1500.00, '2026-04-30', '2026-04-30 20:00'),
    (uid, acc_tr,    1600.00, '2026-05-31', '2026-05-31 20:00'),
    (uid, acc_tr,    1700.00, '2026-06-30', '2026-06-30 20:00'),
    (uid, acc_tr,    1800.00, '2026-07-31', '2026-07-31 20:00'),
    (uid, acc_tr,    1850.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_tr,    1990.00, '2026-09-30', '2026-09-30 20:00'),
    (uid, acc_tr,    2140.00, '2026-10-13', '2026-10-13 20:00');

  -- Julho/agosto: anteriores ao snapshot de 08-31 (não mexem no saldo atual),
  -- mas dão médias realistas aos insights do Balanço.
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
  select uid, acc_ordem, cat, amt, kind, (m || day)::date, note, (m || day || ' 12:00')::timestamptz
  from (values ('2026-07-'), ('2026-08-')) months(m)
  cross join (values
    (c_salario,      1150.00, 'income',  '01', 'Ordenado'),
    (c_casa,          350.00, 'expense', '02', 'Renda do quarto'),
    (c_transp,         40.00, 'expense', '05', 'Passe Navegante'),
    (c_alim,           46.10, 'expense', '06', 'Continente'),
    (c_lazer,          12.99, 'expense', '07', 'Spotify'),
    (c_alim,           39.75, 'expense', '15', 'Pingo Doce'),
    (c_lazer,          32.00, 'expense', '18', 'Jantar com amigos'),
    (c_invest,        200.00, 'expense', '26', 'Reforço ETF'),
    (c_alim,           44.20, 'expense', '27', 'Lidl')
  ) as t(cat, amt, kind, day, note);

  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at) values
    (uid, acc_ordem, c_salario,      1150.00, 'income',  '2026-09-01', 'Ordenado setembro', '2026-09-01 09:00'),
    (uid, acc_ordem, c_casa,          350.00, 'expense', '2026-09-02', 'Renda do quarto',   '2026-09-02 10:00'),
    (uid, acc_ordem, c_alim,           42.80, 'expense', '2026-09-03', 'Continente',        '2026-09-03 19:00'),
    (uid, acc_ordem, c_transp,         40.00, 'expense', '2026-09-05', 'Passe Navegante',   '2026-09-05 08:00'),
    (uid, acc_ordem, c_lazer,          12.99, 'expense', '2026-09-07', 'Spotify',           '2026-09-07 12:00'),
    (uid, acc_ordem, c_alim,           18.50, 'expense', '2026-09-10', 'Almoço na tasca',   '2026-09-10 13:30'),
    (uid, acc_ordem, c_alim,           51.20, 'expense', '2026-09-18', 'Pingo Doce',        '2026-09-18 19:00'),
    (uid, acc_ordem, c_saude,          14.90, 'expense', '2026-09-22', 'Farmácia',          '2026-09-22 18:00'),
    (uid, acc_ordem, c_invest,        200.00, 'expense', '2026-09-26', 'Reforço ETF',       '2026-09-26 10:00'),
    (uid, acc_ordem, c_salario,      1150.00, 'income',  '2026-10-01', 'Ordenado outubro',  '2026-10-01 09:00'),
    (uid, acc_ordem, c_casa,          350.00, 'expense', '2026-10-02', 'Renda do quarto',   '2026-10-02 10:00'),
    (uid, acc_ordem, c_transp,         40.00, 'expense', '2026-10-03', 'Passe Navegante',   '2026-10-03 08:00'),
    (uid, acc_ordem, c_alim,           47.35, 'expense', '2026-10-04', 'Continente',        '2026-10-04 19:00'),
    (uid, acc_ordem, c_invest,        200.00, 'expense', '2026-10-06', 'Reforço ETF',       '2026-10-06 10:00'),
    (uid, acc_ordem, c_lazer,          12.99, 'expense', '2026-10-07', 'Spotify',           '2026-10-07 12:00'),
    (uid, acc_ordem, c_lazer,          24.00, 'expense', '2026-10-08', 'Cinema',            '2026-10-08 21:00'),
    (uid, acc_ordem, c_alim,           38.60, 'expense', '2026-10-12', 'Lidl',              '2026-10-12 18:30'),
    (uid, acc_ordem, c_outros_gastos,  29.99, 'expense', '2026-10-13', 'Ginásio',           '2026-10-13 07:30'),
    (uid, acc_ordem, c_transp,          8.40, 'expense', '2026-10-15', 'Uber',              '2026-10-15 23:40'),
    (uid, acc_ordem, c_alim,           52.10, 'expense', '2026-10-17', 'Continente',        '2026-10-17 19:10'),
    (uid, acc_ordem, c_saude,           9.80, 'expense', '2026-10-19', 'Farmácia',          '2026-10-19 18:20'),
    (uid, acc_ordem, c_alim,            6.50, 'expense', '2026-10-21', 'Café e pastel',     '2026-10-21 10:15');

  -- --- Rita: conta mínima (só o que aparece no ecrã dela) ----------------------
  select id into r_ordem from public.accounts where user_id = rid and name = 'Conta à Ordem';
  select id into r_alim from public.categories where user_id = rid and name = 'Alimentação';
  select id into r_lazer from public.categories where user_id = rid and name = 'Lazer';
  insert into public.net_worth_snapshots (user_id, account_id, value, snapshot_date, created_at)
    values (rid, r_ordem, 640.00, '2026-09-30', '2026-09-30 20:00');
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at) values
    (rid, r_ordem, r_alim, 31.40, 'expense', '2026-10-16', 'Mercearia', '2026-10-16 18:00'),
    (rid, r_ordem, r_lazer, 9.99, 'expense', '2026-10-18', 'Netflix',   '2026-10-18 12:00');

  -- --- Amigos ------------------------------------------------------------------
  -- Rita e Sofia ligadas nos dois sentidos (o que _link_friends faz ao aceitar).
  insert into public.friends (owner_id, name, status, linked_user_id, created_at)
    values (uid, 'Rita Ferreira', 'connected', rid, '2026-09-01') returning id into f_rita;
  insert into public.friends (owner_id, name, status, linked_user_id, created_at)
    values (rid, 'Sofia Martins', 'connected', uid, '2026-09-01') returning id into rf_sofia;
  insert into public.friend_requests (from_user_id, friend_id, to_email, status, accepted_by, created_at, responded_at)
    values (uid, f_rita, rita_email, 'accepted', rid, '2026-09-01 10:00', '2026-09-01 10:05');

  insert into public.friends (owner_id, name, created_at) values (uid, 'João', '2026-09-14') returning id into f_joao;
  insert into public.friends (owner_id, name, created_at) values (uid, 'Miguel', '2026-09-30') returning id into f_miguel;
  insert into public.friends (owner_id, name, created_at) values (uid, 'Inês', '2026-09-12') returning id into f_ines;

  -- Rita, confirmado: jantar de aniversário (Sofia pagou 90, a parte da Rita 30)
  -- e devolução parcial de 15 por banco.
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
    values (uid, acc_ordem, c_lazer, 90.00, 'expense', '2026-09-25', 'Jantar de aniversário', '2026-09-25 22:00')
    returning id into tx_jantar;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, status, created_by, transaction_id, created_at)
    values (uid, f_rita, 'paid_for_them', 30.00, 'Jantar de aniversário', '2026-09-25', 'confirmed', uid, tx_jantar, '2026-09-25 22:05')
    returning id into e_own;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, status, created_by, mirror_id, created_at)
    values (rid, rf_sofia, 'paid_for_me', 30.00, 'Jantar de aniversário', '2026-09-25', 'confirmed', uid, e_own, '2026-09-25 22:05')
    returning id into e_mirror;
  update public.ledger_entries set mirror_id = e_mirror where id = e_own;

  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
    values (uid, acc_ordem, c_devol, 15.00, 'income', '2026-10-09', 'Devolução: Rita Ferreira', '2026-10-09 15:00')
    returning id into tx_rita;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on, settlement, status, created_by,
                                     bank_account_id, bank_category_id, transaction_id, created_at)
    values (uid, f_rita, 'repaid_to_me', 15.00, '2026-10-09', 'bank', 'confirmed', rid, acc_ordem, c_devol, tx_rita, '2026-10-09 15:00')
    returning id into e_own;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on, settlement, status, created_by, mirror_id, created_at)
    values (rid, rf_sofia, 'repaid_to_them', 15.00, '2026-10-09', 'bank', 'confirmed', rid, e_own, '2026-10-09 15:00')
    returning id into e_mirror;
  update public.ledger_entries set mirror_id = e_mirror where id = e_own;

  -- João: a Sofia deve-lhe o bilhete (atrasado). Miguel: deve à Sofia o Uber (atrasado).
  -- Inês: prenda conjunta, já acertada.
  insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, due_on, created_at) values
    (uid, f_joao, 'paid_for_me', 35.00, 'Bilhete do concerto', '2026-09-14', '2026-10-18', '2026-09-14 20:00'),
    (uid, f_miguel, 'paid_for_them', 12.50, 'Uber para casa', '2026-09-30', '2026-10-15', '2026-09-30 02:00'),
    (uid, f_ines, 'paid_for_them', 20.00, 'Prenda conjunta', '2026-09-12', null, '2026-09-12 18:00');
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
    values (uid, acc_ordem, c_devol, 20.00, 'income', '2026-09-20', 'Devolução: Inês', '2026-09-20 11:00')
    returning id into tx_ines;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, occurred_on, settlement, transaction_id, created_at)
    values (uid, f_ines, 'repaid_to_me', 20.00, '2026-09-20', 'bank', tx_ines, '2026-09-20 11:00');

  -- Ontem: sushi de 60 € dividido por igual entre 4 (15 € cada). Uma transação no
  -- total + uma entrada por amigo, ligadas à transação (como o Registo rápido faz).
  -- A da Rita é partilhada: conta já do lado da Sofia, está "pending" à espera dela.
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
    values (uid, acc_ordem, c_alim, 60.00, 'expense', '2026-10-22', 'Sushi com a malta', '2026-10-22 22:30')
    returning id into tx_sushi;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, transaction_id, created_at) values
    (uid, f_joao, 'paid_for_them', 15.00, 'Sushi com a malta', '2026-10-22', tx_sushi, '2026-10-22 22:31'),
    (uid, f_miguel, 'paid_for_them', 15.00, 'Sushi com a malta', '2026-10-22', tx_sushi, '2026-10-22 22:31');
  insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, status, created_by, transaction_id, created_at)
    values (uid, f_rita, 'paid_for_them', 15.00, 'Sushi com a malta', '2026-10-22', 'pending', uid, tx_sushi, '2026-10-22 22:31')
    returning id into e_own;
  insert into public.ledger_entries (user_id, friend_id, kind, amount, note, occurred_on, status, created_by, mirror_id, created_at)
    values (rid, rf_sofia, 'paid_for_me', 15.00, 'Sushi com a malta', '2026-10-22', 'pending', uid, e_own, '2026-10-22 22:31')
    returning id into e_mirror;
  update public.ledger_entries set mirror_id = e_mirror where id = e_own;

  -- --- Perfil da Sofia ------------------------------------------------------------
  insert into public.goals (user_id, title, due_on, done, created_at) values
    (uid, 'Viagem ao Japão', '2027-06-30', false, '2026-07-02'),
    (uid, 'Fundo de emergência (3 meses)', '2026-12-31', false, '2026-07-02'),
    (uid, 'Tirar a carta', '2026-09-15', true, '2026-07-02');
  insert into public.notes (user_id, body, created_at) values
    (uid, 'Pedir recibo da renda ao senhorio.', '2026-10-20 09:00');
end $$;
