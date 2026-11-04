"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/components/providers";
import { listOccurrences } from "@/lib/api/occurrences";
import Map from "@/components/map/map";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { statusLabels, type Bounds, type Status } from "@/types";
export default function MapPage() {
  const { demo } = useAuth();
  const [bounds, setBounds] = useState<Bounds>();
  const [status, setStatus] = useState<Status | "">("");
  const [point, setPoint] = useState<[number, number]>();
  const [locating, setLocating] = useState(false);
  const source = demo || !supabase;
  const {
    data = [],
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["map", source, bounds, status],
    queryFn: () =>
      listOccurrences(source, { bounds, status: status || undefined }),
    enabled: !!bounds,
  });
  function locate() {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não oferece geolocalização.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPoint([p.coords.latitude, p.coords.longitude]);
        setLocating(false);
      },
      () => {
        toast.error(
          "Não foi possível acessar sua localização. Você pode navegar pelo mapa manualmente.",
        );
        setLocating(false);
      },
      { timeout: 12000, maximumAge: 30000 },
    );
  }
  return (
    <Shell
      title="Mapa colaborativo"
      subtitle="Explore a cidade por outros olhares. Cada ponto é uma oportunidade de melhoria."
      publicMap
    >
      <section className="panel">
        <div className="map-toolbar">
          <div className="filter-row">
            <SlidersHorizontal size={17} />
            <label htmlFor="map-status">Status</label>
            <select
              id="map-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status | "")}
            >
              <option value="">Todos os status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="muted">
              {isFetching ? "Atualizando…" : `${data.length} na região`}
            </span>
          </div>
          <Button variant="outline" onClick={locate} disabled={locating}>
            <LocateFixed size={16} />
            {locating ? "Localizando…" : "Minha localização"}
          </Button>
        </div>
        {error && (
          <div className="alert" role="alert">
            Não foi possível buscar os pontos.{" "}
            <button onClick={() => refetch()}>Tentar novamente</button>
          </div>
        )}
        {data.length === 500 && (
          <p role="status" className="muted">
            Exibindo os 500 registros mais recentes desta área. Aproxime o mapa
            ou filtre por status para consultar outros pontos.
          </p>
        )}
        <div className="full-map">
          <Map records={data} onBounds={setBounds} point={point} />
        </div>
        <div className="map-legend">
          <span>
            <i className="red" /> Reportado
          </span>
          <span>
            <i className="orange" /> Em análise
          </span>
          <span>
            <i className="green" /> Resolvido
          </span>
          <span className="ml-auto">
            Mova o mapa para explorar outras regiões.
          </span>
        </div>
      </section>
    </Shell>
  );
}
