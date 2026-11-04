import { useEffect, useRef } from "react";
import { mapHTML } from "./html";
import { handleMapMessage, mapPayload, type MapProps } from "./types";
import { useTheme } from "../theme";
export default function Map(props: MapProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { isDark } = useTheme();
  const data = JSON.stringify(mapPayload(props, isDark));
  function update() {
    ref.current?.contentWindow?.postMessage(
      { source: "viaalerta-app", payload: JSON.parse(data) },
      "*",
    );
  }
  useEffect(() => {
    update();
    const handler = (event: MessageEvent) => {
      if (event.source === ref.current?.contentWindow) {
        handleMapMessage(event.data, props);
        try {
          if (JSON.parse(event.data).type === "ready") update();
        } catch {}
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [data, props.onBounds, props.onSelect, props.onPoint]);
  return (
    <iframe
      ref={ref}
      title="Mapa interativo de ocorrências"
      srcDoc={mapHTML}
      sandbox="allow-scripts allow-same-origin"
      onLoad={update}
      style={{
        border: 0,
        width: "100%",
        height: "100%",
        borderRadius: 15,
        background: "#eaf0e9",
      }}
    />
  );
}
