import { Directory, File, Paths } from "expo-file-system";
export async function persistDemoPhoto(uri: string, id: string) {
  const dir = new Directory(Paths.document, "viaalerta-demo");
  dir.create({ idempotent: true, intermediates: true });
  const destination = new File(dir, `${id}.jpg`);
  new File(uri).copy(destination);
  return destination.uri;
}
