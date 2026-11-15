import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { draftQueue } from "./draft-queue";

export const offlineDrafts = draftQueue(AsyncStorage, {
  copy: async (photo, id, owner) => {
    if (Platform.OS === "web")
      throw new Error(
        "Rascunhos com fotos sem internet estão disponíveis no aplicativo Android.",
      );
    const directory = new Directory(Paths.document, "viaalerta-offline", owner);
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${id}.jpg`);
    if (!destination.exists) new File(photo.uri).copy(destination);
    return destination.uri;
  },
  remove: async (uri) => {
    if (Platform.OS === "web") return;
    const base = new Directory(Paths.document, "viaalerta-offline").uri;
    const target = new URL(uri),
      prefix = new URL(base.endsWith("/") ? base : base + "/");
    if (target.protocol !== "file:" || !target.href.startsWith(prefix.href))
      throw new Error("Arquivo fora da pasta de rascunhos.");
    const file = new File(uri);
    if (file.exists) file.delete();
  },
});
