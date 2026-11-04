"use client";
import Image from "next/image";
import type { Analysis } from "@/types";
export function DetectionImage({
  src,
  analysis,
}: {
  src: string;
  analysis?: Analysis;
}) {
  return (
    <div
      className="detection-image"
      style={
        analysis
          ? {
              aspectRatio: `${analysis.image_width} / ${analysis.image_height}`,
            }
          : {}
      }
    >
      <Image
        src={src}
        width={analysis?.image_width || 800}
        height={analysis?.image_height || 500}
        unoptimized
        alt="Fotografia enviada para identificar buracos"
      />
      {analysis && (
        <svg
          viewBox={`0 0 ${analysis.image_width} ${analysis.image_height}`}
          role="img"
          aria-label={`${analysis.detections.length} detecções ${analysis.simulated ? "simuladas" : ""}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {analysis.detections.map((d, i) => {
            const [x1, y1, x2, y2] = d.bbox;
            const font = Math.max(12, analysis.image_width / 45);
            return (
              <g key={i}>
                <rect
                  x={x1}
                  y={y1}
                  width={x2 - x1}
                  height={y2 - y1}
                  fill="#49ec9e18"
                  stroke="#50f0a5"
                  strokeWidth={Math.max(2, analysis.image_width / 300)}
                />
                <rect
                  x={x1}
                  y={Math.max(0, y1 - font * 1.6)}
                  width={font * 11}
                  height={font * 1.6}
                  fill="#50f0a5"
                />
                <text
                  x={x1 + font * 0.3}
                  y={Math.max(font, y1 - font * 0.4)}
                  fontSize={font}
                  fill="#103b29"
                  fontWeight="700"
                >
                  buraco · {Math.round(d.confidence * 100)}%
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {analysis?.simulated && (
        <span className="image-demo">Análise simulada</span>
      )}
    </div>
  );
}
