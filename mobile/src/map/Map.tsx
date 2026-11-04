import { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { mapHTML } from "./html";
import { handleMapMessage, mapPayload, type MapProps } from "./types";
import { useTheme } from "../theme";
const source = { html: mapHTML, baseUrl: "https://viaalerta.local" };
export default function Map(props: MapProps) {
  const ref = useRef<WebView>(null);
  const { isDark } = useTheme();
  const data = JSON.stringify(mapPayload(props, isDark));
  function update() {
    ref.current?.injectJavaScript(
      `window.setViaData&&window.setViaData(${data.replace(/</g, "\\u003c")});true;`,
    );
  }
  useEffect(update, [data]);
  return (
    <View style={{ flex: 1, overflow: "hidden", borderRadius: 15 }}>
      <WebView
        ref={ref}
        source={source}
        originWhitelist={["https://viaalerta.local"]}
        onShouldStartLoadWithRequest={(r) =>
          r.url === "about:blank" || r.url.startsWith("https://viaalerta.local")
        }
        onLoadEnd={update}
        onMessage={(event) => {
          try {
            if (JSON.parse(event.nativeEvent.data).type === "ready") update();
          } catch {}
          handleMapMessage(event.nativeEvent.data, props);
        }}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        mixedContentMode="never"
        geolocationEnabled={false}
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "#eaf0e9" }}
      />
    </View>
  );
}
