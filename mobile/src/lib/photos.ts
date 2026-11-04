import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { Photo } from "../types";
import { assertPhoto } from "./detection-contract";
export async function preparePhoto(
  uri: string,
  width: number,
  height: number,
): Promise<Photo> {
  if (width * height > 40_000_000)
    throw new Error("A foto excede 40 megapixels.");
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > 2000)
    context.resize(width >= height ? { width: 2000 } : { height: 2000 });
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
    quality: 1,
    exif: false,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return;
  const item = result.assets[0];
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
  } else
    body.append("file", {
      uri: photo.uri,
      name: photo.name,
      type: photo.mime,
    } as unknown as Blob);
  return body;
}
