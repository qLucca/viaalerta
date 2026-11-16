# Aplicativo Android

A versão 1.0.3 (código 4) utiliza o pacote `com.viaalerta.app` e a mesma assinatura de teste das versões anteriores. O instalador e seu manifesto SHA-256 ficam em `distribuicao/`, fora do Git. Instale o APK sobre a versão anterior, sem desinstalar, para preservar sessão e rascunhos. A instalação e as permissões precisam ser conferidas em aparelho físico.

## Funcionalidades da web disponíveis no app

| Área | Android |
| --- | --- |
| Conta | Nome, foto privada, preferências separadas de e-mail e WhatsApp, troca de senha |
| Autenticador | Cadastro local por QR Code ou chave manual; verificação da sessão com seis números |
| Registro | Câmera e galeria, foto preparada em JPEG de até 1600 pixels no maior lado, resultado da IA e correção humana |
| Outros problemas | Calçada, sinalização, iluminação, bueiro, alagamento e outro, encaminhados sem IA para avaliação humana |
| Localização | GPS com margem de precisão, ajuste no mapa e coordenadas manuais |
| Duplicidade | Consulta de registros semelhantes a até 30 m, com abertura do registro e confirmação de que é outro problema |
| Autoria | Edição da observação e cancelamento antes do atendimento, conforme autorização do servidor |
| Mapa | Situação, tipo de problema, período e apenas meus registros públicos |
| Prefeitura | Fila por situação, histórico, previsão de intervenção, motivos de rejeição e foto de conclusão |
| Exportação | Gestor e administrador com sessão autorizada salvam a fila em CSV na pasta escolhida no Android |
| Administração | Indicadores, busca e paginação de usuários, suspensão com prazo, banimento reversível e remoção de restrição |
| Denúncias | Envio pelo registro; administração recebe, analisa e pode ocultar ou restaurar o registro com justificativa |
| Acesso institucional | Solicitação, aprovação, rejeição e revogação, respeitando município e MFA |
| Notificações | Histórico no app, marcação de leitura e contador na aba Avisos |
| Privacidade | Texto disponível no instalador e acesso à versão pública atualizada |

As permissões continuam no Supabase, com validação por conta, município, perfil e nível de autenticação. O app não possui credenciais administrativas embutidas e não concede privilégios apenas por abrir uma tela. Suspensões e banimentos preservam registros e podem ser revistos; não excluem a identidade do Supabase.

## IA e serviços externos

Web e APK apontam para a mesma API HTTPS na Azure. O modelo roda no servidor; substituir os pesos na API atualiza as próximas análises reais de ambos, sem gerar outro APK. Resultados anteriores permanecem como registrados. A demonstração usa resultados simulados e não publica na base real. O detector de produção identifica apenas buracos; a confiança não mede gravidade.

Preferências de contato não confirmam que houve envio. E-mail e WhatsApp exigem provedores e segredos configurados no servidor. Veja [comunicações](COMUNICACOES.md). Não há chave de envio no APK.

## Sem conexão

O Android pode guardar foto, ponto, tipo de problema, risco informado e observações em rascunhos separados por conta, limitados a 20 itens e 80 MiB. Rascunhos antigos são lidos como buraco sem indicação de risco. É preciso ter uma sessão previamente restaurada; uma sessão expirada pode exigir internet.

O envio ocorre somente após autorização explícita quando houver conexão, sem análise automática da IA. A confirmação da conta e as permissões são verificadas novamente no servidor. O app não envia automaticamente ao reconectar. GPS depende do sinal do aparelho; ruas do mapa, IA, dados compartilhados e operações de gestão precisam de conexão. O mapa não inclui um pacote de ruas para uso offline.

## Verificação antes da distribuição

Na pasta `mobile`, execute `npm test` e `npm run typecheck`. Para compilar com SDK Android e JDK compatíveis já configurados, execute `android/gradlew.bat assembleRelease` a partir de `mobile/android`. Confira se `app.json` e o projeto Android gerado usam o mesmo nome e código de versão. Preserve a chave de assinatura; alterá-la impede atualização sobre instalações anteriores.

Os testes de interface usam respostas fictícias e não substituem o teste físico: instalação sobre o APK anterior, câmera e galeria, permissões negadas, QR do autenticador, aparelho em modo avião, reabertura de rascunhos, reconexão e fluxo municipal completo. A assinatura atual é de teste; distribuição formal exige o planejamento de uma chave própria e sua migração.
