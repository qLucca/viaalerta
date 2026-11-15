import * as Location from "expo-location";
import type { Point } from "../types";
export type LocationFix = {
  point: Point;
  accuracy: number | null;
  capturedAt: number;
};
export async function currentFix(): Promise<LocationFix> {
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
        accuracy: Location.Accuracy.High,
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
    const { latitude, longitude, accuracy } = result.coords;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      throw new Error(
        "O aparelho retornou uma posição inválida. Ajuste o ponto manualmente.",
      );
    return {
      point: [latitude, longitude],
      accuracy:
        typeof accuracy === "number" &&
        Number.isFinite(accuracy) &&
        accuracy >= 0
          ? accuracy
          : null,
      capturedAt: result.timestamp,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
export async function currentPoint(): Promise<Point> {
  return (await currentFix()).point;
}
