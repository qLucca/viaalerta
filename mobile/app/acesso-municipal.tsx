import { useState } from "react";
import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  Card,
  Txt,
  Button,
  Field,
  Notice,
  Loading,
} from "../src/components/ui";
import { Choices } from "../src/components/Choices";
import { useAuth } from "../src/providers";
import { supabase } from "../src/lib/supabase";
import { processError } from "../src/lib/process";
export default function MunicipalAccess() {
  const { user, loading, demo } = useAuth();
  const [city, setCity] = useState(""),
    [role, setRole] = useState("agent"),
    [organization, setOrganization] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const cities = useQuery({
    queryKey: ["municipalities", user?.id],
    enabled: !!user && !demo && !!supabase,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("viaalerta_municipalities")
        .select("id,name");
      if (error)
        throw Error("Cadastro municipal indisponível. Tente novamente.");
      return data as { id: string; name: string }[];
    },
  });
  async function submit() {
    setError("");
    setBusy(true);
    try {
      if (!city || !cities.data?.some((c) => c.id === city))
        throw Error("Escolha o município.");
      if (organization.trim().length < 5 || organization.trim().length > 120)
        throw Error("Informe órgão e setor com 5 a 120 caracteres.");
      const result = await supabase!.rpc("viaalerta_request_access", {
        p_municipality: city,
        p_role: role,
        p_organization: organization.trim(),
      });
      if (result.error) throw Error(processError(result.error));
      setMessage(
        "Solicitação recebida. Seu acesso permanece como cidadão até a aprovação.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Screen
      title="Solicitar acesso institucional"
      subtitle="Aprovação e permissões são conferidas pelo administrador."
      back
    >
      <Card style={{ gap: 16 }}>
        <Txt>
          Use um e-mail institucional gov.br confirmado. Outros domínios exigem
          análise do responsável pela implantação. Esta solicitação não concede
          permissões automaticamente.
        </Txt>
        {demo ? (
          <Notice text="Entre com uma conta institucional real para solicitar acesso." />
        ) : cities.isPending ? (
          <Loading />
        ) : cities.error ? (
          <>
            <Notice error text={cities.error.message} />
            <Button
              title="Tentar carregar municípios novamente"
              onPress={() => void cities.refetch()}
            />
          </>
        ) : (
          <>
            {!cities.data?.length ? (
              <Notice text="Nenhum município disponível." />
            ) : (
              <Choices
                label="Município"
                value={city}
                options={Object.fromEntries(
                  cities.data.map((c) => [c.id, c.name]),
                )}
                onChange={setCity}
                disabled={busy || !!message}
              />
            )}
            <Choices
              label="Acesso solicitado"
              value={role}
              options={{
                agent: "Agente municipal",
                manager: "Gestor municipal",
              }}
              onChange={setRole}
              disabled={busy || !!message}
            />
            <Field
              label="Órgão e setor"
              value={organization}
              onChangeText={setOrganization}
              maxLength={120}
              editable={!busy && !message}
            />
            <Button
              title="Enviar solicitação"
              onPress={() => void submit()}
              busy={busy}
              disabled={!city || !!message}
            />
          </>
        )}
        {!!message && <Notice text={message} />}{" "}
        {!!error && <Notice error text={error} />}
      </Card>
    </Screen>
  );
}
