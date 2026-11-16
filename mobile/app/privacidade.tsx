import { useState } from "react";
import { Linking } from "react-native";
import { Screen, Card, Txt, Button, Notice } from "../src/components/ui";
import { privacySections } from "../src/lib/privacy";
import { openPortal } from "../src/lib/portal";
export default function Privacy() {
  const [error, setError] = useState("");
  return (
    <Screen
      title="Privacidade e proteção de dados"
      subtitle="Transparência no ViaAlerta · disponível também sem conexão."
      back
    >
      <Card style={{ gap: 16 }}>
        {privacySections.map(([tag, text], i) => (
          <Txt
            key={i}
            style={
              tag === "h2"
                ? { fontSize: 20, fontWeight: "700" }
                : { lineHeight: 23 }
            }
          >
            {tag === "li" ? "• " : ""}
            {text}
          </Txt>
        ))}
        <Txt>
          Você pode optar separadamente por e-mail e WhatsApp em Foto e contato
          e retirar a autorização depois. Isso impede novos envios após a
          atualização; mensagens entregues não podem ser recolhidas.
        </Txt>
        <Txt>
          Rascunhos com fotos ficam neste aparelho, separados por conta, até
          envio ou remoção. A análise da IA e o envio precisam de internet. A
          localização confirmada pode ser pública; o GPS possui margem de erro.
        </Txt>
        <Txt>
          Contato de privacidade: admin.via.alerta@gmail.com. Informe o pedido e
          o e-mail da conta, sem enviar senha ou códigos do autenticador.
        </Txt>
        <Button
          title="Contatar responsável por privacidade"
          outline
          onPress={() =>
            void Linking.openURL("mailto:admin.via.alerta@gmail.com").catch(
              () =>
                setError(
                  "Use seu aplicativo de e-mail para escrever a admin.via.alerta@gmail.com.",
                ),
            )
          }
        />
        <Button
          title="Ler versão pública atualizada"
          outline
          onPress={() =>
            void openPortal("/privacidade").catch(() =>
              setError(
                "Não foi possível abrir a página. A cópia acima permanece disponível.",
              ),
            )
          }
        />
        <Button
          title="Direitos dos titulares na ANPD"
          outline
          onPress={() =>
            void Linking.openURL(
              "https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares",
            ).catch(() => setError("Não foi possível abrir a página da ANPD."))
          }
        />
        {!!error && <Notice error text={error} />}
      </Card>
    </Screen>
  );
}
