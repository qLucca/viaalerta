"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Bounds, Occurrence } from "@/types";
import { statusLabels } from "@/types";
import {
  DEFAULT_CITY,
  previouslyAllowedLocation,
  validMapPoints,
} from "@/lib/location";
import { dateLabel } from "@/lib/format";
const noRecords: Occurrence[] = [];
const colors = {
  pendente: "#e7665b",
  em_analise: "#e8a044",
  programado: "#386db0",
  em_execucao: "#7248a8",
  resolvido: "#23836b",
  rejeitado: "#8f5555",
  duplicado: "#596681",
  encaminhado: "#5c7390",
};
function pin(color: string, label = "") {
  return L.divIcon({
    className: "map-pin-container",
    html: `<span class="map-pin" style="--pin:${color}"><span>${label}</span></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 35],
  });
}
function Points({
  records,
  onSelect,
}: {
  records: Occurrence[];
  onSelect?: (id: string) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      iconCreateFunction: (group) =>
        L.divIcon({
          html: `<span class="cluster-count">${group.getChildCount()}</span>`,
          className: "cluster",
          iconSize: [40, 40],
        }),
    });
    records.forEach((record) => {
      const content = document.createElement("div");
      content.className = "map-popup";
      const image = document.createElement("img");
      image.src = record.image_url || record.image_path;
      image.alt = "Foto do registro";
      content.appendChild(image);
      const title = document.createElement("strong");
      title.textContent = statusLabels[record.status];
      content.appendChild(title);
      const date = document.createElement("p");
      date.textContent =
        dateLabel(record.created_at) + (record.simulated ? " · Simulado" : "");
      content.appendChild(date);
      const link = document.createElement("a");
      link.href = `/ocorrencias/${record.id}`;
      link.textContent = "Ver registro →";
      content.appendChild(link);
      cluster.addLayer(
        L.marker([record.latitude, record.longitude], {
          icon: pin(
            colors[record.status],
            {
              pendente: "R",
              em_analise: "A",
              programado: "P",
              em_execucao: "E",
              resolvido: "✓",
              rejeitado: "×",
              duplicado: "D",
              encaminhado: "↗",
            }[record.status],
          ),
          title: statusLabels[record.status] + " · " + record.description,
          alt: "Abrir registro " + record.id,
        })
          .bindPopup(content)
          .on("click", () => onSelect?.(record.id)),
      );
    });
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, records, onSelect]);
  return null;
}
function InitialViewport({
  records,
  ready,
  point,
}: {
  records: Occurrence[];
  ready: boolean;
  point?: [number, number];
}) {
  const map = useMap();
  const initialized = useRef(false);
  const interacted = useRef(false);
  useEffect(() => {
    const container = map.getContainer();
    const touch = () => {
      interacted.current = true;
    };
    const events = ["pointerdown", "wheel", "keydown"];
    events.forEach((event) => container.addEventListener(event, touch));
    return () =>
      events.forEach((event) => container.removeEventListener(event, touch));
  }, [map]);
  useEffect(() => {
    if (point) {
      initialized.current = true;
      return;
    }
    if (!ready || initialized.current || interacted.current) return;
    initialized.current = true;
    const positions = validMapPoints(records);
    if (positions.length) {
      map.fitBounds(L.latLngBounds(positions), {
        padding: [32, 32],
        maxZoom: 16,
        animate: false,
      });
      return;
    }
    let active = true;
    void previouslyAllowedLocation().then((location) => {
      if (active && location && !interacted.current)
        map.setView(location, 14, { animate: false });
    });
    return () => {
      active = false;
    };
  }, [map, records, ready, point]);
  return null;
}
function SelectedRecord({ record }: { record?: Occurrence }) {
  const map = useMap();
  const last = useRef<string | undefined>(undefined);
  const id = record?.id,
    lat = record?.latitude,
    lon = record?.longitude;
  useEffect(() => {
    if (id && id !== last.current && lat !== undefined && lon !== undefined) {
      last.current = id;
      map.setView([lat, lon], Math.max(16, map.getZoom()), { animate: false });
    }
  }, [map, id, lat, lon]);
  return null;
}
function MapEvents({
  onBounds,
  onPoint,
  viewportReady,
}: {
  onBounds?: (bounds: Bounds) => void;
  onPoint?: (point: [number, number]) => void;
  viewportReady: boolean;
}) {
  const map = useMap();
  const send = useCallback(() => {
    const b = map.getBounds();
    onBounds?.({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    });
  }, [map, onBounds]);
  useMapEvents({
    moveend: send,
    zoomend: send,
    resize: send,
    click(e) {
      onPoint?.([e.latlng.lat, e.latlng.lng]);
    },
  });
  useEffect(() => {
    // O enquadramento inicial pode ocorrer antes da assinatura dos eventos do Leaflet.
    const frame = requestAnimationFrame(send);
    return () => cancelAnimationFrame(frame);
  }, [send, viewportReady]);
  return null;
}
function LocationPoint({
  point,
  onPoint,
  accuracy,
}: {
  point: [number, number];
  onPoint?: (point: [number, number]) => void;
  accuracy?: number;
}) {
  const map = useMap();
  const ref = useRef<L.Marker>(null);
  useEffect(() => {
    if (accuracy !== undefined) map.setView(point, Math.max(map.getZoom(), 18));
    else map.panTo(point);
  }, [point, map, accuracy]);
  return (
    <>
      {accuracy !== undefined &&
        Number.isFinite(accuracy) &&
        accuracy >= 0 &&
        accuracy <= 10000 && (
          <Circle
            center={point}
            radius={accuracy}
            pathOptions={{ color: "#25836b", fillOpacity: 0.1, weight: 1 }}
          />
        )}
      <Marker
        ref={ref}
        position={point}
        icon={pin("#25836b")}
        title="Local selecionado"
        alt="Marcador do local selecionado"
        draggable={!!onPoint}
        eventHandlers={{
          dragend() {
            const p = ref.current?.getLatLng();
            if (p) onPoint?.([p.lat, p.lng]);
          },
        }}
      />
    </>
  );
}
export default function MapCanvas({
  records = noRecords,
  selectedId,
  onSelect,
  initialRecords,
  initialReady = true,
  point,
  accuracy,
  onPoint,
  onBounds,
  center = DEFAULT_CITY.center,
}: {
  records?: Occurrence[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  initialRecords?: Occurrence[];
  initialReady?: boolean;
  point?: [number, number];
  accuracy?: number;
  onPoint?: (point: [number, number]) => void;
  onBounds?: (bounds: Bounds) => void;
  center?: [number, number];
}) {
  return (
    <MapContainer
      center={point || center}
      zoom={14}
      scrollWheelZoom
      className="leaflet-map"
      aria-label="Mapa interativo de registros"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <InitialViewport
        records={initialRecords ?? records}
        ready={initialReady}
        point={point}
      />
      <MapEvents
        onBounds={onBounds}
        onPoint={onPoint}
        viewportReady={initialReady}
      />
      {point && (
        <LocationPoint point={point} onPoint={onPoint} accuracy={accuracy} />
      )}
      <SelectedRecord record={records.find((r) => r.id === selectedId)} />
      <Points records={records} onSelect={onSelect} />
    </MapContainer>
  );
}
