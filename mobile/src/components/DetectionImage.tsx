import React from "react";
import { Image, View } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import type { Analysis } from "../types";
import { Txt } from "./ui";
export function DetectionImage({
  uri,
  width,
  height,
  analysis,
}: {
  uri: string;
  width: number;
  height: number;
  analysis?: Analysis;
}) {
  return (
    <View
      accessibilityLabel={`Fotografia com ${analysis?.detections.length || 0} detecções${analysis?.simulated ? " simuladas" : ""}`}
      style={{
        width: "100%",
        aspectRatio: width / height,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#E0E9E3",
      }}
    >
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="contain"
        accessibilityLabel="Fotografia da ocorrência"
      />
      {analysis && (
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {analysis.detections.map((d, i) => {
            const [x1, y1, x2, y2] = d.bbox;
            const font = width / 35;
            return (
              <React.Fragment key={i}>
                <Rect
                  x={x1}
                  y={y1}
                  width={x2 - x1}
                  height={y2 - y1}
                  fill="#7be29c22"
                  stroke="#70F6A7"
                  strokeWidth={width / 200}
                />
                <Rect
                  x={x1}
                  y={Math.max(0, y1 - font * 1.5)}
                  width={font * 10.5}
                  height={font * 1.5}
                  fill="#70F6A7"
                />
                <SvgText
                  x={x1 + font * 0.2}
                  y={Math.max(font, y1 - font * 0.35)}
                  fill="#194E31"
                  fontSize={font}
                  fontWeight="700"
                >
                  buraco · {Math.round(d.confidence * 100)}%
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      )}
      {analysis?.simulated && (
        <View
          style={{
            position: "absolute",
            right: 9,
            bottom: 9,
            backgroundColor: "#183E30EE",
            borderRadius: 5,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Txt style={{ color: "#fff", fontSize: 9 }}>ANÁLISE SIMULADA</Txt>
        </View>
      )}
    </View>
  );
}
