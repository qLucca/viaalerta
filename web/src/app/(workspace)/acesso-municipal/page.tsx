"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers";
import { supabase } from "@/lib/supabase/client";
import { accessAction } from "@/lib/api/process";
export default function AccessRequest() {
  const { demo } = useAuth();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const cities = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("viaalerta_municipalities")
        .select("id,name");
      if (error)
        throw new Error("Cadastro municipal ainda não está disponível.");
      return data;
    },
    enabled: !demo && !!supabase,
  });
  return (
    <Shell
      title="Solicitar acesso institucional"
      subtitle="Solicitações são revisadas pelo administrador antes de liberar qualquer permissão."
    >
      <form
        className="panel form-section stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await accessAction("viaalerta_request_access", {
              p_municipality: data.get("municipality"),
              p_role: data.get("role"),
              p_organization: data.get("organization"),
            });
            setMessage(
              "Solicitação recebida. Seu acesso permanece como cidadão até a aprovação.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Entre com um e-mail institucional gov.br confirmado. Se precisar de
          outro domínio, fale com o responsável pela implantação para análise
          institucional.
        </p>
        <label htmlFor="request-city">Município</label>
        <select
          name="municipality"
          id="request-city"
          required
          disabled={busy || demo}
        >
          {cities.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label htmlFor="request-role">Acesso solicitado</label>
        <select id="request-role" name="role" disabled={busy || demo}>
          <option value="agent">Agente municipal</option>
          <option value="manager">Gestor municipal</option>
        </select>
        <label className="field">
          Órgão e setor
          <input
            name="organization"
            required
            minLength={5}
            maxLength={120}
            disabled={busy || demo}
          />
        </label>
        <Button disabled={busy || demo || !!message || !cities.data?.length}>
          {busy ? "Enviando…" : "Enviar solicitação"}
        </Button>
        {demo && <p>Esta ação exige uma conta institucional real.</p>}
        {cities.error && <p role="alert">{cities.error.message}</p>}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </Shell>
  );
}
