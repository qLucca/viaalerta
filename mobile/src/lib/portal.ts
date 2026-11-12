import { Linking } from "react-native";
export function portalUrl(
  path: "/seguranca" | "/administracao" | "/acesso-municipal",
) {
  const url = new URL(
    process.env.EXPO_PUBLIC_WEB_URL ||
      "https://viaalerta-web.lemonground-59ee7d93.centralus.azurecontainerapps.io",
  );
  if (url.protocol !== "https:")
    throw new Error("Configure o portal com HTTPS.");
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}
export async function openPortal(
  path: "/seguranca" | "/administracao" | "/acesso-municipal",
) {
  await Linking.openURL(portalUrl(path));
}
