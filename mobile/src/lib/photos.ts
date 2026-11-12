import { Platform, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { Photo } from "../types";
import { assertPhoto } from "./detection-contract";
import { resizeForPhoto, selectWithFallback } from "./photo-selection";
export async function preparePhoto(
  uri: string,
  width: number,
  height: number,
): Promise<Photo> {
  if (!width || !height) {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) =>
      Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject));
    width = dimensions.width; height = dimensions.height;
  }
  const resize = resizeForPhoto(width, height);
  const context = ImageManipulator.manipulate(uri);
  if (resize) context.resize(resize);
  const rendered = await context.renderAsync();
  const output = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.88,
  });
  const size =
    Platform.OS === "web"
      ? (await (await fetch(output.uri)).blob()).size
      : new File(output.uri).size;
  assertPhoto(size, output.width, output.height);
  return {
    uri: output.uri,
    width: output.width,
    height: output.height,
    size,
    name: "viaalerta-foto.jpg",
    mime: "image/jpeg",
  };
}
export async function pickPhoto(camera: boolean) {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Permita o acesso à câmera nas configurações ou escolha uma foto da galeria.",
      );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.9,
    exif: false,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await selectWithFallback(legacy => ImagePicker.launchImageLibraryAsync({ ...options, legacy }), Platform.OS === "android");
  if (result.canceled) return;
  const item = result.assets?.[0];
  if (!item?.uri) throw new Error("Nenhuma imagem válida foi selecionada.");
  return preparePhoto(item.uri, item.width, item.height);
}
export async function examplePhoto() {
  const asset = Asset.fromModule(require("../../assets/demo-road.jpg"));
  await asset.downloadAsync();
  return preparePhoto(asset.localUri || asset.uri, 800, 500);
}
export async function photoBytes(photo: Photo) {
  return Platform.OS === "web"
    ? (await fetch(photo.uri)).arrayBuffer()
    : new File(photo.uri).arrayBuffer();
}
export async function multipartPhoto(photo: Photo) {
  const body = new FormData();
  if (Platform.OS === "web") {
    body.append("file", await (await fetch(photo.uri)).blob(), photo.name);
  } else {
    // expo/fetch lê o arquivo local como Blob, sem depender do objeto URI do fetch legado.
    body.append("file", new File(photo.uri), photo.name);
  }
  return body;
}

export async function recoverPhoto() {
  if (Platform.OS !== "android") return;
  const result = await ImagePicker.getPendingResultAsync();
  if (!result) return;
  if ("code" in result) throw new Error("Não foi possível recuperar a foto. Escolha a imagem novamente.");
  if (result.canceled) return;
  const item = result.assets?.[0];
  if (item?.uri) return preparePhoto(item.uri, item.width, item.height);
}
