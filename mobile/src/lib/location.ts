import * as Location from "expo-location";
import type { Point } from "../types";
export async function currentPoint(): Promise<Point> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Localização negada. Escolha o ponto no mapa ou permita o acesso nas configurações do Android.",
    );
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error(
      "Ative a localização do aparelho ou escolha o ponto no mapa.",
    );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "Não foi possível localizar em 15 segundos. Escolha o ponto manualmente.",
              ),
            ),
          15000,
        );
      }),
    ]);
    return [result.coords.latitude, result.coords.longitude];
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
