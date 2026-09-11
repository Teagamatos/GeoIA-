-- ATENÇÃO: só rode essa migration DEPOIS de confirmar que o login com
-- Google está funcionando (você consegue entrar e navegar pelo dashboard
-- normalmente). Antes disso, rodar isso vai bloquear o próprio dashboard,
-- porque ele ainda estaria usando a chave anon sem sessão.
--
-- O que faz: troca as policies das tabelas geo_* de "to public" (qualquer
-- um com a chave anon/publishable) para "to authenticated" (só quem tiver
-- feito login). A automação do n8n não é afetada — ela usa a service_role
-- key, que sempre ignora RLS.

-- geo_dominio_proprio
drop policy if exists select_publico_leitura on public.geo_dominio_proprio;
create policy select_autenticado_leitura on public.geo_dominio_proprio
  for select to authenticated using (true);

-- geo_execucao
drop policy if exists select_publico_leitura on public.geo_execucao;
create policy select_autenticado_leitura on public.geo_execucao
  for select to authenticated using (true);

-- geo_fonte
drop policy if exists select_publico_leitura on public.geo_fonte;
create policy select_autenticado_leitura on public.geo_fonte
  for select to authenticated using (true);

-- geo_marca (select + insert + update + delete)
drop policy if exists select_publico_leitura on public.geo_marca;
create policy select_autenticado_leitura on public.geo_marca
  for select to authenticated using (true);

drop policy if exists insert_publico on public.geo_marca;
create policy insert_autenticado on public.geo_marca
  for insert to authenticated with check (true);

drop policy if exists update_publico on public.geo_marca;
create policy update_autenticado on public.geo_marca
  for update to authenticated using (true) with check (true);

drop policy if exists delete_publico on public.geo_marca;
create policy delete_autenticado on public.geo_marca
  for delete to authenticated using (true);

-- geo_marca_alias (select + insert + update + delete)
drop policy if exists select_publico_leitura on public.geo_marca_alias;
create policy select_autenticado_leitura on public.geo_marca_alias
  for select to authenticated using (true);

drop policy if exists insert_publico on public.geo_marca_alias;
create policy insert_autenticado on public.geo_marca_alias
  for insert to authenticated with check (true);

drop policy if exists update_publico on public.geo_marca_alias;
create policy update_autenticado on public.geo_marca_alias
  for update to authenticated using (true) with check (true);

drop policy if exists delete_publico on public.geo_marca_alias;
create policy delete_autenticado on public.geo_marca_alias
  for delete to authenticated using (true);

-- geo_mencao
drop policy if exists select_publico_leitura on public.geo_mencao;
create policy select_autenticado_leitura on public.geo_mencao
  for select to authenticated using (true);

-- geo_prompt (select + insert + update + delete)
drop policy if exists select_publico_leitura on public.geo_prompt;
create policy select_autenticado_leitura on public.geo_prompt
  for select to authenticated using (true);

drop policy if exists insert_publico on public.geo_prompt;
create policy insert_autenticado on public.geo_prompt
  for insert to authenticated with check (true);

drop policy if exists update_publico on public.geo_prompt;
create policy update_autenticado on public.geo_prompt
  for update to authenticated using (true) with check (true);

drop policy if exists delete_publico on public.geo_prompt;
create policy delete_autenticado on public.geo_prompt
  for delete to authenticated using (true);
