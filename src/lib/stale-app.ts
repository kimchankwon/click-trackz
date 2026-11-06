const STALE_APP_ERROR = /requiring unknown module|loading (css )?chunk|chunkloaderror|dynamically imported module|could not find public function/i;

export function isStaleAppError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return STALE_APP_ERROR.test(message);
}

const ENTRY_SCRIPT = /\/_expo\/static\/js\/web\/entry-[\w-]+\.js/;

export function entryScriptIn(html: string): string | null {
  return html.match(ENTRY_SCRIPT)?.[0] ?? null;
}
