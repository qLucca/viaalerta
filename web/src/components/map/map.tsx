"use client";
import dynamic from "next/dynamic";
const Map = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <span className="spinner" />
      Carregando mapa…
    </div>
  ),
});
export default Map;
