"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/components/providers";
import { listOccurrences } from "@/lib/api/occurrences";
import { supportRecord } from "@/lib/api/registration";
import { problemTypes } from "@/lib/registration";
import { dateLabel, plural } from "@/lib/format";
import { StatusBadge } from "@/components/occurrences";
import { Button } from "@/components/ui/button";
import Map from "@/components/map/map";
import { supabase } from "@/lib/supabase/client";
import { statusLabels, type Bounds, type Status } from "@/types";
export default function MapPage() {
  const { demo, loading, user } = useAuth();
  const [bounds, setBounds] = useState<Bounds>(),
    [status, setStatus] = useState<Status | "">(""),
    [type, setType] = useState(""),
    [days, setDays] = useState(""),
    [mine, setMine] = useState(false),
    [selected, setSelected] = useState(""),
    [point, setPoint] = useState<[number, number]>(),
    [locating, setLocating] = useState(false),
    [supporting, setSupporting] = useState(false);
  const source = demo || !supabase;
  const initial = useQuery({
    queryKey: ["map-initial", source],
    queryFn: () => listOccurrences(source, { limit: 500 }),
    enabled: !loading,
  });
  const [referenceTime] = useState(() => Date.now());
  const since = days
    ? new Date(referenceTime - Number(days) * 86400000).toISOString()
    : undefined;
  const query = useQuery({
    queryKey: ["map", source, bounds, status, type, days, mine, user?.id],
    queryFn: () =>
      listOccurrences(source, {
        bounds,
        status: status || undefined,
        type: type || undefined,
        since,
        mine: mine && !!user,
        publicOnly: true,
      }),
    enabled: !!bounds && !initial.isPending,
  });
  const records = query.data || [],
    record = records.find((r) => r.id === selected);
  function locate() {
    if (!navigator.geolocation) {
      toast.error("Localização não disponível.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPoint([p.coords.latitude, p.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error(
          "Não foi possível obter sua localização. Você pode navegar pelo mapa.",
        );
      },
      { timeout: 12000 },
    );
  }
  return (
    <Shell
      title="Mapa colaborativo"
      subtitle="Use os filtros, o mapa ou a lista para consultar os registros."
      publicMap
    >
      <section className="panel">
        <div className="map-filters">
          <div>
            <label htmlFor="map-status">Status</label>
            <select
              id="map-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status | "")}
            >
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="map-type">Tipo</label>
            <select
              id="map-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(problemTypes).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="map-period">Período</label>
            <select
              id="map-period"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="">Todo o período</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={mine}
              disabled={!user}
              onChange={(e) => setMine(e.target.checked)}
            />
            Apenas meus registros
          </label>
          <Button variant="outline" disabled={locating} onClick={locate}>
            {locating ? "Localizando…" : "Minha localização"}
          </Button>
        </div>
        {!user && (
          <p>
            Entre na sua conta para consultar apenas seus registros ou apoiar um
            problema.
          </p>
        )}
        <p className="map-count" role="status">
          {initial.isPending || query.isFetching
            ? "Carregando registros…"
            : `${plural(records.length, "registro")} nesta área`}
        </p>
        {(query.error || initial.error) && (
          <div role="alert">
            Não foi possível carregar os registros.{" "}
            <button
              onClick={() => {
                void query.refetch();
                void initial.refetch();
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!initial.isPending &&
          !query.isFetching &&
          !query.error &&
          !initial.error &&
          !records.length && (
            <div className="map-empty">
              <p>
                Ainda não há registros nesta área. Seja o primeiro a avisar.
              </p>
              <Link className="button button-outline" href="/registrar">
                Registrar um problema
              </Link>
            </div>
          )}
        <div className="map-browser">
          <div className="full-map">
            <Map
              records={records}
              initialRecords={initial.data}
              initialReady={!initial.isPending}
              point={point}
              onBounds={setBounds}
              selectedId={selected}
              onSelect={setSelected}
            />
          </div>
          <aside
            className="map-record-list"
            aria-label="Lista de registros na área"
          >
            <h2>Registros nesta área</h2>
            <p>Selecione um item para localizar o pino e abrir seu resumo.</p>
            <ul>
              {records.map((r) => (
                <li key={r.id}>
                  <button
                    className="map-list-item"
                    aria-pressed={r.id === selected}
                    onClick={() => setSelected(r.id)}
                  >
                    <strong>{problemTypes[r.problem_type || "buraco"]}</strong>
                    <StatusBadge status={r.status} />
                    <span>Local aproximado · {dateLabel(r.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        {records.length === 500 && (
          <p>
            Exibindo até 500 registros. Aproxime o mapa ou refine os filtros.
          </p>
        )}
        {record && (
          <section
            className="map-selected"
            aria-label="Resumo do registro selecionado"
          >
            <Image
              unoptimized
              src={record.image_url || record.image_path}
              width={240}
              height={180}
              alt="Foto do registro selecionado"
            />
            <div>
              <h2>{problemTypes[record.problem_type || "buraco"]}</h2>
              <StatusBadge status={record.status} />
              <p>{record.description || "Sem observações adicionais."}</p>
              <p>Local aproximado · {dateLabel(record.created_at)}</p>
              <div className="actions">
                <Link
                  className="button button-outline"
                  href={`/ocorrencias/${record.id}`}
                >
                  Abrir acompanhamento
                </Link>
                <Button
                  disabled={
                    !user ||
                    supporting ||
                    [
                      "resolvido",
                      "rejeitado",
                      "duplicado",
                      "encaminhado",
                    ].includes(record.status)
                  }
                  onClick={async () => {
                    setSupporting(true);
                    try {
                      await supportRecord(record.id, demo);
                      toast.success(
                        demo
                          ? "Apoio de demonstração salvo."
                          : "Seu apoio foi salvo.",
                      );
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setSupporting(false);
                    }
                  }}
                >
                  {supporting ? "Salvando…" : "Eu também vi este problema"}
                </Button>
              </div>
            </div>
          </section>
        )}
      </section>
    </Shell>
  );
}
