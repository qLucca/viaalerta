# Administração e moderação

O painel web `/administracao` reúne indicadores, gestão de usuários, central de denúncias, aprovação institucional e auditoria. Somente administrador ativo com sessão MFA `aal2` consegue consultar os dados ou decidir sobre uma conta. Os e-mails dos usuários e dos denunciantes não são expostos nas páginas públicas.

## Usuários

O painel mostra contas cadastradas e confirmadas, novas contas nos últimos 30 dias, contas restritas, quantidade de registros e denúncias abertas. A lista aceita busca por nome ou e-mail e filtro por situação, com páginas de 20 contas. Cada conta mostra data de cadastro, último login, papel, contagem de contribuições e denúncias recebidas sobre seus registros. Último login não mede presença online nem tempo de uso.

As ações são suspensão com prazo futuro (até 365 dias), banimento sem prazo e remoção da restrição. Todas exigem justificativa e confirmação explícita. A justificativa é mostrada à pessoa na tela de conta restrita; não inclua dados de terceiros. O administrador não pode restringir a própria conta, e o banco preserva ao menos um administrador ativo.

A suspensão expira automaticamente ao chegar ao prazo, sem depender de um job agendado. A remoção de restrição restaura as permissões anteriores. Conteúdo e evidências são preservados; suspender uma conta não oculta automaticamente todos os seus registros. A revisão deve considerar cada caso, sem punição automática pela contagem de denúncias.

## Denúncias

As denúncias enviadas nas páginas das ocorrências entram como recebidas. O administrador pode filtrar recebidas, em análise, resolvidas e arquivadas, registrar uma nota interna e consultar autor, denunciante, motivo e data. A nota interna fica na administração. Ocultar ou restaurar um registro é uma ação separada da classificação da denúncia.

Ocultar remove o registro das consultas públicas, mas a URL direta de uma foto já publicada em bucket público pode continuar acessível. A retirada do arquivo do armazenamento precisa de uma intervenção específica; esta limitação foi registrada na revisão do projeto.

## O que o bloqueio faz

A restrição vale para as funções autenticadas do ViaAlerta, com validação no banco, na API de inferência e nas rotas web de upload. Escritas via RPCs antigas e acesso direto ao banco também são protegidos por triggers e políticas. A interface web e o código mobile verificam a situação periodicamente e mostram motivo, prazo e um canal para solicitar revisão. Uma interface antiga pode demorar a atualizar o aviso; as regras no banco já impedem novas contribuições.

O banimento não exclui a identidade no Supabase Auth, não apaga contribuições e não é um banimento global de outros serviços. A página pública continua pública. Uma pessoa ainda pode recuperar ou proteger a credencial de autenticação. Para invalidar também a identidade e as sessões do Supabase Auth, seria necessária uma integração administrativa adicional via API oficial, com segredo somente no servidor; ela não foi implementada neste pacote.

## Ativação

1. Faça backup e confira quais migrações já estão instaladas no projeto Supabase atual.
2. Aplique as pendentes de 004 a 006, nesta ordem. `node infra/preparar-migracao.mjs --from=4` prepara o pacote local em `supabase/implantacao.local.sql`, em uma transação. Se 004 já estiver aplicada, use `--from=5`; se 005 também estiver aplicada, use `--from=6`. A 006 corrige a preservação de consentimento por canal sem retirar os bloqueios de contas restritas. O comando não se conecta ao banco. Não reaplique as migrações sem conferir o estado atual.
3. Publique a API e a web atualizadas. A API precisa da consulta de situação de conta para impedir inferência de contas restritas. As versões web/API toleram a ausência da função apenas durante a transição anterior à instalação de 005; as restrições só podem ser criadas depois da migração.
4. Gere um novo APK para incluir a tela de conta restrita. O APK antigo ainda está sujeito às regras de escrita do banco após a migração, mas pode exibir mensagens menos claras.
5. Teste suspensão, vencimento, reativação e denúncia usando contas controladas. Confira a auditoria e nunca teste a punição em uma conta real de terceiro sem motivo.

As migrações continuam fora do Git, conforme a decisão anterior do projeto. Mantenha uma cópia privada versionada dos pacotes de banco. Os arquivos de código e os guias novos devem ser selecionados explicitamente no próximo commit; nenhuma publicação automática foi feita por esta implementação.
