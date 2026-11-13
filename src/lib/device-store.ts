import { File, Paths } from "expo-file-system";

const deviceFile = (name: string) => new File(Paths.document, `${name}.json`);

export async function readDeviceValue(name: string): Promise<string | null> {
  const file = deviceFile(name);
  return file.exists ? file.text() : null;
}

export async function writeDeviceValue(name: string, json: string): Promise<void> {
  const file = deviceFile(name);
  if (!file.exists) file.create();
  await file.write(json);
}

export async function clearDeviceValue(name: string): Promise<void> {
  const file = deviceFile(name);
  if (file.exists) file.delete();
}
