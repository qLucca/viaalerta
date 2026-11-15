# Localização e rascunhos sem internet

## Escolher o ponto

Na web ou no Android, use **Minha localização** no mapa ou **Usar minha localização atual** ao registrar. O aplicativo solicita uma posição nova, priorizando precisão. Quando o aparelho informa a margem de erro, ela aparece em metros e como um círculo no mapa. As coordenadas são exibidas com seis casas decimais; isso não garante precisão física equivalente.

Confira onde a fotografia foi tirada. Sua posição atual pode ser diferente do local da foto. Ajuste o marcador ou informe latitude e longitude, depois confirme o ponto. A margem do GPS deixa de ser exibida quando o ponto é ajustado manualmente. Não há consulta automática de rua ou bairro.

## Guardar no Android

1. Entre na conta enquanto houver conexão. Restaure uma sessão válida no aparelho; o primeiro login depende de internet.
2. Escolha uma foto. Sem internet, use **Continuar sem análise da IA**.
3. Obtenha o GPS ou informe as coordenadas, confira e confirme o local.
4. Na revisão, escolha **Guardar no aparelho e enviar depois**. A cópia da foto e as coordenadas ficam no armazenamento privado do aplicativo, separadas por conta.
5. Abra **Ver rascunhos neste aparelho** na tela de registro. Com conexão, confira o item e escolha **Revisar autorização e enviar**. Confirme a publicação da foto e do ponto.

Não há envio automático ao reconectar. Cada rascunho tem um identificador estável: repetir uma tentativa com resposta perdida consulta o registro existente antes de criar outro. A conta é conferida novamente no envio; as regras de acesso do servidor continuam valendo.

Se a conferência da conta falhar por conexão, o Android oferece um modo local limitado ao mapa, registro e rascunhos. Ele não concede acesso administrativo nem dispensa a autenticação do servidor. Uma suspensão ou banimento já conhecido mantém o bloqueio. Uma sessão expirada pode exigir novo login com internet antes de acessar esses recursos.

O limite é de 20 rascunhos e 80 MiB de fotos por conta e aparelho, com até 8 MiB por imagem. O envio de um rascunho é identificado como **sem análise da IA**; não há inferência local. Após o envio confirmado, o rascunho é removido. Falhas de leitura não apagam os dados. Não se trata de backup: limpar os dados do aplicativo ou desinstalá-lo pode apagar as fotos locais.

## Limites do modo offline

| Recurso | Sem internet |
| --- | --- |
| Guardar foto preparada, observações e coordenadas no Android | Sim, com sessão restaurada válida |
| Obter coordenadas por GPS | Depende do sinal e das permissões do aparelho |
| Ajustar marcador ou informar coordenadas | Sim; a base de ruas pode não aparecer |
| Baixar ruas de uma região para uso offline | Não implementado |
| Consultar ocorrências atualizadas, prefeitura, IA, login e enviar registros | Exige conexão |
| Guardar rascunhos de fotos no navegador | Não implementado |

O mapa usa Leaflet incluído no aplicativo e imagens de ruas do OpenStreetMap carregadas pela internet. Não há download antecipado de regiões: a [política do servidor padrão de mapas](https://operations.osmfoundation.org/policies/tiles/) proíbe esse uso. Para ruas realmente offline, será necessário selecionar um provedor com essa permissão ou hospedar mapas próprios.

Os testes automatizados verificam fila, isolamento entre contas, limites, repetição de envios, falhas de armazenamento e contratos de localização. A validação final no Android deve incluir modo avião, fechar e reabrir o aplicativo, reiniciar o aparelho, revogar a permissão de localização e reconectar para enviar. A exportação do bundle Android não substitui a geração e instalação de um novo APK.
