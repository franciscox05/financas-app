-- Utilizador de demonstração para o vídeo de pitch (dados fictícios).
-- Idempotente: apaga o demo anterior e recria tudo. Substituir __DEMO_PASSWORD__
-- antes de correr no SQL Editor do Supabase.
-- Datas pensadas para "hoje" = 2026-10-14 (duas dívidas atrasadas, uma a vencer).

do $$
declare
  demo_email constant text := 'demo@financasapp.com';
  uid uuid;
  acc_ordem uuid; acc_poup uuid; acc_xtb uuid; acc_tr uuid;
  c_salario uuid; c_outros_ganhos uuid; c_alim uuid; c_transp uuid; c_casa uuid;
  c_lazer uuid; c_saude uuid; c_outros_gastos uuid; c_invest uuid;
  tx_jantar uuid; tx_rita uuid; tx_ines uuid;
  d_rita uuid; d_ines uuid;
begin
  -- Reset (ordem explícita: transactions -> accounts usa "on delete restrict").
  select id into uid from auth.users where email = demo_email;
  if uid is not null then
    delete from public.debt_payments where user_id = uid;
    delete from public.debts where user_id = uid;
    delete from public.savings_goals where user_id = uid;
    delete from public.budgets where user_id = uid;
    delete from public.net_worth_snapshots where user_id = uid;
    delete from public.transactions where user_id = uid;
    delete from public.recurring_transactions where user_id = uid;
    delete from public.transfers where user_id = uid;
    delete from public.category_rules where user_id = uid;
    delete from public.accounts where user_id = uid;
    delete from public.categories where user_id = uid;
    delete from auth.identities where user_id = uid;
    delete from auth.users where id = uid;
  end if;

  uid := gen_random_uuid();

  -- O trigger on_auth_user_created cria profile, contas e categorias default.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    demo_email, extensions.crypt('__DEMO_PASSWORD__', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Sofia Martins"}',
    '2026-07-01', now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', demo_email, 'email_verified', true),
    'email', now(), now()
  );

  select id into acc_ordem from public.accounts where user_id = uid and name = 'Conta à Ordem';
  select id into acc_xtb from public.accounts where user_id = uid and name = 'XTB';
  select id into acc_tr from public.accounts where user_id = uid and name = 'Trade Republic';
  insert into public.accounts (user_id, name, type, created_at)
    values (uid, 'Poupança', 'cash', '2026-07-01') returning id into acc_poup;

  select id into c_salario from public.categories where user_id = uid and name = 'Salário';
  select id into c_outros_ganhos from public.categories where user_id = uid and name = 'Outros Ganhos';
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
    (uid, acc_poup,  1900.00, '2026-04-30', '2026-04-30 20:00'),
    (uid, acc_poup,  2050.00, '2026-05-31', '2026-05-31 20:00'),
    (uid, acc_poup,  2200.00, '2026-06-30', '2026-06-30 20:00'),
    (uid, acc_xtb,   2600.00, '2026-04-30', '2026-04-30 20:00'),
    (uid, acc_xtb,   2750.00, '2026-05-31', '2026-05-31 20:00'),
    (uid, acc_xtb,   2900.00, '2026-06-30', '2026-06-30 20:00'),
    (uid, acc_tr,    1500.00, '2026-04-30', '2026-04-30 20:00'),
    (uid, acc_tr,    1600.00, '2026-05-31', '2026-05-31 20:00'),
    (uid, acc_tr,    1700.00, '2026-06-30', '2026-06-30 20:00'),
    (uid, acc_ordem, 1240.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_poup, 2350.00, '2026-07-31', '2026-07-31 20:00'),
    (uid, acc_poup, 2500.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_poup, 2650.00, '2026-09-30', '2026-09-30 20:00'),
    (uid, acc_poup, 2800.00, '2026-10-13', '2026-10-13 20:00'),
    (uid, acc_xtb, 3100.00, '2026-07-31', '2026-07-31 20:00'),
    (uid, acc_xtb, 3240.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_xtb, 3480.00, '2026-09-30', '2026-09-30 20:00'),
    (uid, acc_xtb, 3725.00, '2026-10-13', '2026-10-13 20:00'),
    (uid, acc_tr, 1800.00, '2026-07-31', '2026-07-31 20:00'),
    (uid, acc_tr, 1850.00, '2026-08-31', '2026-08-31 20:00'),
    (uid, acc_tr, 1990.00, '2026-09-30', '2026-09-30 20:00'),
    (uid, acc_tr, 2140.00, '2026-10-13', '2026-10-13 20:00');

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
    (uid, acc_ordem, c_lazer,          24.00, 'expense', '2026-10-08', 'Cinema',            '2026-10-08 21:00'),
    (uid, acc_ordem, c_lazer,          12.99, 'expense', '2026-10-07', 'Spotify',           '2026-10-07 12:00'),
    (uid, acc_ordem, c_alim,           38.60, 'expense', '2026-10-12', 'Lidl',              '2026-10-12 18:30'),
    (uid, acc_ordem, c_outros_gastos,  29.99, 'expense', '2026-10-13', 'Ginásio',           '2026-10-13 07:30');

  -- Dívidas: Rita (pagamento parcial, vence em 6 dias), João e Miguel (atrasadas), Inês (acertada).
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
    values (uid, acc_ordem, c_lazer, 90.00, 'expense', '2026-09-25', 'Jantar de aniversário', '2026-09-25 22:00')
    returning id into tx_jantar;
  insert into public.debts (user_id, direction, counterparty_name, amount, note, transaction_id, due_on, created_at)
    values (uid, 'owed_to_me', 'Rita', 30.00, 'Jantar de aniversário', tx_jantar, '2026-10-20', '2026-09-25 22:05')
    returning id into d_rita;
  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
    values (uid, acc_ordem, c_outros_ganhos, 15.00, 'income', '2026-10-09', 'Dívida: Rita', '2026-10-09 15:00')
    returning id into tx_rita;
  insert into public.debt_payments (user_id, debt_id, amount, paid_on, transaction_id, created_at)
    values (uid, d_rita, 15.00, '2026-10-09', tx_rita, '2026-10-09 15:00');

  insert into public.debts (user_id, direction, counterparty_name, amount, note, due_on, created_at) values
    (uid, 'i_owe', 'João', 35.00, 'Bilhete do concerto', '2026-10-10', '2026-09-14 20:00'),
    (uid, 'owed_to_me', 'Miguel', 12.50, 'Uber para casa', '2026-10-07', '2026-09-30 02:00');

  insert into public.transactions (user_id, account_id, category_id, amount, type, occurred_on, note, created_at)
    values (uid, acc_ordem, c_outros_ganhos, 20.00, 'income', '2026-09-20', 'Dívida: Inês', '2026-09-20 11:00')
    returning id into tx_ines;
  insert into public.debts (user_id, direction, counterparty_name, amount, note, status, settled_transaction_id, created_at, settled_at)
    values (uid, 'owed_to_me', 'Inês', 20.00, 'Prenda conjunta', 'settled', tx_ines, '2026-09-12 18:00', '2026-09-20 11:00')
    returning id into d_ines;
  insert into public.debt_payments (user_id, debt_id, amount, paid_on, transaction_id, created_at)
    values (uid, d_ines, 20.00, '2026-09-20', tx_ines, '2026-09-20 11:00');

  insert into public.budgets (user_id, category_id, month, amount) values
    (uid, c_alim, '2026-10-01', 200.00),
    (uid, c_lazer, '2026-10-01', 80.00);

  insert into public.savings_goals (user_id, account_id, name, target_amount, target_date)
    values (uid, acc_poup, 'Viagem ao Japão', 3500.00, '2027-06-30');
end $$;
