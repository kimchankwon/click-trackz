import { File, Paths } from "expo-file-system";

const libraryFile = () => new File(Paths.document, "my-library.json");

export async function readStoredLibrary(): Promise<string | null> {
  const file = libraryFile();
  return file.exists ? file.text() : null;
}

export async function writeStoredLibrary(json: string): Promise<void> {
  const file = libraryFile();
  if (!file.exists) file.create();
  await file.write(json);
}

export async function clearStoredLibrary(): Promise<void> {
  const file = libraryFile();
  if (file.exists) file.delete();
}
