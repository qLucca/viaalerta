# Conta, privacidade e comunicações

O perfil permite adicionar uma foto privada e optar separadamente por e-mail e WhatsApp. A página `/seguranca` cadastra TOTP por QR Code, valida a sessão e troca a senha. A página pública `/privacidade` explica o uso dos dados e informa o contato autorizado `admin.via.alerta@gmail.com`.

## Ordem de ativação

1. Faça backup do banco atual e confira as migrações instaladas. Aplique as migrações pendentes em ordem, até `202611160007_email_delivery_safety.sql`. A 004 cria preferências, avatares privados e a fila de WhatsApp; a 005 aplica moderação e restrições de conta; a 006 preserva o consentimento de cada canal separadamente; a 007 impede reenvio automático quando o aceite é incerto e adia envios por limite do provedor. `node infra/preparar-migracao.mjs --from=4` prepara o pacote 004–007; use `--from=7` se as anteriores já estiverem aplicadas. O comando não se conecta à produção. Os arquivos SQL continuam fora do Git conforme a decisão anterior do projeto: preserve uma cópia local para implantação e recuperação.
2. Configure os serviços abaixo no ambiente de segredos das Edge Functions. Use `.env.example` apenas como lista de nomes; nunca publique valores de acesso.
3. Publique `send-notifications` no projeto correto com a CLI do Supabase. A função usa um segredo de agendamento próprio, validado pelo código. Quando necessário, desative a verificação JWT da plataforma apenas para essa função com `supabase functions deploy send-notifications --no-verify-jwt`; não desative a verificação do segredo próprio.
4. Configure o agendamento protegido do canal contratado via POST: `...?channel=email` ou `...?channel=whatsapp`. Ambos exigem `Authorization: Bearer <NOTIFICATIONS_CRON_SECRET>`. Guarde esse segredo no cofre do agendador, nunca em um arquivo SQL versionado. Um intervalo de 5 minutos é suficiente para o piloto. Ativar e-mail não requer ativar WhatsApp.
5. Publique a web na Azure somente depois da migração. Teste com uma conta controlada, autorize o canal no perfil e gere uma nova atualização de ocorrência. O usuário precisa controlar o número e confirmar o e-mail da conta.

Sem provedor configurado, a função retorna 503 antes de consumir a fila. O site informa que salvar preferências não confirma envios. Não há disparos retroativos para notificações anteriores à autorização atual.

No Android, `Meu perfil → Foto e preferências de contato` edita os mesmos dados
da web. `Segurança e autenticador` permite cadastrar TOTP por QR ou chave manual,
verificar a sessão e trocar a senha. O QR e a chave são exibidos no dispositivo,
sem serviço externo de geração. A foto de perfil é preparada pelo app e enviada
à rota HTTPS `/api/profile-photo` da web, que precisa estar publicada.

A migração 006 registra a autorização e o destinatário por canal. Alterar ou
desativar WhatsApp não altera a data de autorização de e-mail; trocar o número
exige nova autorização. Depois de alterar o e-mail da conta, salve novamente a
preferência de e-mail para autorizar o destinatário novo. Retirar e conceder
consentimento novamente não libera notificações anteriores à autorização nova.

## E-mail

A integração aceita Brevo ou Resend. Configure `EMAIL_PROVIDER=brevo` com `BREVO_API_KEY`, ou `EMAIL_PROVIDER=resend` com `RESEND_API_KEY`. A ausência de `EMAIL_PROVIDER` mantém Resend para instalações anteriores. Os demais segredos são `NOTIFICATIONS_FROM`, `NOTIFICATIONS_WEB_URL` (origem HTTPS do site) e `NOTIFICATIONS_CRON_SECRET`. O e-mail de contato de privacidade não é automaticamente um remetente validado.

### Piloto sem domínio próprio: Brevo

O [plano gratuito do Brevo](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) permite até 300 e-mails por dia. Confira os limites no momento da ativação e mantenha contratação paga desativada. O Brevo permite verificar um remetente Gmail, mas pode [substituir o endereço de envio por um domínio próprio do serviço](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders). Para operação contínua, prefira um domínio autenticado; a entrega na caixa de entrada não é garantida.

1. Crie sua conta no Brevo e confirme o endereço da conta. Cadastre um remetente que você controla e conclua a confirmação recebida por e-mail.
2. Crie uma chave de API e configure-a como `BREVO_API_KEY` nos segredos das Edge Functions do Supabase. Não envie a chave em conversas, prints ou arquivos do projeto.
3. Configure `EMAIL_PROVIDER=brevo` e `NOTIFICATIONS_FROM` como `ViaAlerta <seu-email-verificado@gmail.com>`. Defina `NOTIFICATIONS_WEB_URL` com a origem HTTPS da web publicada e um `NOTIFICATIONS_CRON_SECRET` exclusivo e aleatório.
4. Aplique a migração 007 após conferir as anteriores e publique a função. Sem a atualização do banco, o worker retorna 503 sem consumir a fila.
5. Autorize o canal no perfil de uma conta controlada, faça uma atualização nova de ocorrência e teste o processamento manualmente. Depois habilite um único agendador conforme abaixo.

Essa preparação não cria a conta, não configura credenciais e não envia mensagens por si só.

### Alternativa com domínio próprio: Resend

O serviço oferece 3.000 e-mails por mês, limitados a 100 por dia no plano Free;
confira os [limites atuais do Resend](https://resend.com/pricing) antes de ativar.
Mantenha cobranças por excedente desativadas. É necessário um domínio próprio
verificado para enviar a outros usuários; o domínio de teste só permite envio
ao endereço autorizado pela conta Resend. Um endereço Gmail de contato não
substitui a verificação do domínio remetente.

1. Na conta Resend, verifique o domínio por DNS e crie uma chave limitada a envio
   nesse domínio. Configure os quatro segredos da Edge Function citados acima.
   Não coloque a chave no navegador, no APK, em prints ou no Git. Defina `EMAIL_PROVIDER=resend`.
2. Use um remetente do domínio verificado, como `ViaAlerta <avisos@seu-dominio>`.
   `NOTIFICATIONS_WEB_URL` deve ser a origem HTTPS do site publicado.
3. Publique a função e confira sua autenticação por segredo exclusivo. O texto e
   HTML incluem a atualização, eventual previsão de intervenção, link do registro
   e acesso às preferências; nenhum arquivo de foto é anexado.
### Agendamento de e-mail (qualquer provedor)

1. Para usar o workflow `Processar notificacoes por e-mail`, configure no GitHub
   a variável `EMAIL_NOTIFICATIONS_URL` com a URL HTTPS da função
   (`https://SEU-PROJETO.supabase.co/functions/v1/send-notifications`) e o segredo
   `NOTIFICATIONS_CRON_SECRET`, igual ao configurado na Edge Function.
2. Deixe `EMAIL_NOTIFICATIONS_ENABLED` desativada enquanto configurar. Depois de
   autorizar e testar com um destinatário controlado, defina-a como `true`. O
   workflow chama apenas o canal de e-mail a cada cinco minutos; o GitHub pode
   atrasar execuções agendadas. Essa opção substitui o cron de e-mail no banco:
   não mantenha os dois agendadores habilitados.

O envio utiliza destinatários e consentimentos conferidos no servidor. Há um
intervalo de 600 ms entre as requisições do lote e uma chave de idempotência por
notificação. `sent` indica aceite pelo provedor, não entrega ou leitura na caixa
postal. Consulte o painel do provedor para rejeições e devoluções. Limites temporários
adiam o lote sem esgotar as tentativas. Uma resposta desconhecida, timeout ou lease
expirada exige revisão manual antes de reenviar; não há retentativa automática nesses
casos, para reduzir duplicações. As demais falhas têm até seis tentativas. E-mails de autenticação também
consomem a franquia se o mesmo provedor for configurado no Supabase Auth.

O código e os testes podem ser concluídos sem a conta, mas isso não ativa envios
reais. É necessário configurar o provedor, verificar o remetente, aplicar a migração,
publicar a função e configurar o agendador.

Os e-mails de autenticação e recuperação de senha são enviados pelo Supabase Auth, em configuração separada. Configure SMTP e autorize a URL HTTPS `/redefinir-senha` nos redirects de autenticação. A configuração de Resend na Edge Function não configura o SMTP do Auth. Habilite a exigência de reautenticação segura para troca de senha no Auth; a interface aceita o código de confirmação exigido pelo servidor.

## WhatsApp


Utiliza a API oficial WhatsApp Business Cloud API da Meta, sem automação do WhatsApp Web. São necessários conta Business, número habilitado, token com permissões de mensagens, versão suportada da Graph API e modelo de utilidade aprovado no idioma configurado.

Configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION` (como `v27.0`, se suportada na conta), `WHATSAPP_TEMPLATE_NAME` e `WHATSAPP_TEMPLATE_LANGUAGE`. O modelo precisa de dois parâmetros de corpo, nesta ordem: título da atualização e URL HTTPS do registro. Exemplo: “Seu registro no ViaAlerta foi atualizado: {{1}}. Acompanhe: {{2}}. Preferências de contato no perfil do ViaAlerta.”

O provedor pode cobrar pelo uso; esta implementação não cria assinatura nem efetua contratação. O retorno `accepted` indica aceite da API, não entrega ou leitura no celular. Webhooks de confirmação de entrega não foram implementados. Se o resultado de envio for desconhecido, a fila exige revisão manual em vez de reenviar automaticamente e arriscar duplicação. Um telefone alterado desmarca a autorização na interface.

## Privacidade e manutenção

O contato de privacidade é público e pode ser sobrescrito por `PRIVACY_CONTACT_EMAIL` durante o build. Formalize a identificação do controlador, as bases legais e os prazos de conservação conforme a operação real; a página não certifica conformidade com a LGPD. As preferências têm data e versão de autorização. O número fica na área privada do banco e não é inserido nas ocorrências públicas.

A foto de perfil é reprocessada para JPEG de 320 × 320, sem EXIF, e acessada por URL assinada com validade de uma hora. As políticas de armazenamento isolam os objetos por usuário. Fotos de ocorrências e conclusão seguem as regras públicas já existentes. Eventuais objetos órfãos por falha de rede precisam de limpeza administrativa periódica.

## Verificação

Na pasta `web`, execute `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`. Na raiz, com Node compatível com execução de TypeScript, execute:

```sh
node --test supabase/functions/send-notifications/worker.test.mjs supabase/functions/send-notifications/whatsapp.test.mjs
```

Antes de ativar mensagens, confira as documentações oficiais de [MFA do Supabase](https://supabase.com/docs/guides/auth/auth-mfa/totp), [troca de senha](https://supabase.com/docs/reference/javascript/auth-updateuser), [templates do WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/) e [direitos dos titulares na ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares).
