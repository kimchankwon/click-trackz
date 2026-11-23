export async function saveThen<T>(save: (() => Promise<unknown>) | null, next: () => Promise<T>, stillWanted: () => boolean): Promise<T | null> {
  if (save) {
    await save();
    if (!stillWanted()) return null;
  }
  return next();
}
