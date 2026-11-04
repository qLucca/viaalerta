"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Bounds, Occurrence } from "@/types";
import { statusLabels } from "@/types";
const colors = {
  pendente: "#e7665b",
  em_analise: "#e8a044",
  resolvido: "#23836b",
};
function pin(color: string) {
  return L.divIcon({
    className: "map-pin-container",
    html: `<span class="map-pin" style="--pin:${color}"><span></span></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 35],
  });
}
function Points({ records }: { records: Occurrence[] }) {
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
      image.alt = "Foto da ocorrência";
      content.appendChild(image);
      const title = document.createElement("strong");
      title.textContent = statusLabels[record.status];
      content.appendChild(title);
      const date = document.createElement("p");
      date.textContent =
        new Date(record.created_at).toLocaleDateString("pt-BR") +
        (record.simulated ? " · Simulado" : "");
      content.appendChild(date);
      const link = document.createElement("a");
      link.href = `/ocorrencias/${record.id}`;
      link.textContent = "Ver ocorrência →";
      content.appendChild(link);
      cluster.addLayer(
        L.marker([record.latitude, record.longitude], {
          icon: pin(colors[record.status]),
          title: statusLabels[record.status] + " · " + record.description,
          alt: "Abrir ocorrência " + record.id,
        }).bindPopup(content),
      );
    });
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, records]);
  return null;
}
function MapEvents({
  onBounds,
  onPoint,
}: {
  onBounds?: (bounds: Bounds) => void;
  onPoint?: (point: [number, number]) => void;
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
    click(e) {
      onPoint?.([e.latlng.lat, e.latlng.lng]);
    },
  });
  useEffect(() => {
    send();
  }, [send]);
  return null;
}
function LocationPoint({
  point,
  onPoint,
}: {
  point: [number, number];
  onPoint?: (point: [number, number]) => void;
}) {
  const map = useMap();
  const ref = useRef<L.Marker>(null);
  useEffect(() => {
    map.panTo(point);
  }, [point, map]);
  return (
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
  );
}
export default function MapCanvas({
  records = [],
  point,
  onPoint,
  onBounds,
  center = [-23.552, -46.65],
}: {
  records?: Occurrence[];
  point?: [number, number];
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
      aria-label="Mapa interativo de ocorrências"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onBounds={onBounds} onPoint={onPoint} />
      {point && <LocationPoint point={point} onPoint={onPoint} />}
      <Points records={records} />
    </MapContainer>
  );
}
