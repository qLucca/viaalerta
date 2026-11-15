import { Linking } from "react-native";
type PortalPath =
  | "/seguranca"
  | "/administracao"
  | "/acesso-municipal"
  | "/perfil"
  | "/privacidade"
  | "/api/profile-photo";
export function portalUrl(path: PortalPath) {
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
export async function openPortal(path: PortalPath) {
  await Linking.openURL(portalUrl(path));
}
