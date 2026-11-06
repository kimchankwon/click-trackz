const MAX_LENGTH = 240;

type NativeErrorInfo = { nativeDomain: string; nativeCode: number; nativeDesc: string };

export type AudioFailureFacts = {
  state: string;
  waitedMs: number;
  timedOut: boolean;
  resumeError: string | null;
  sessionError: string | null;
};

export function describeAudioError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const info = (error as { nativeErrorInfo?: NativeErrorInfo }).nativeErrorInfo;
  return info ? `${error.message} (${info.nativeDomain} ${info.nativeCode}: ${info.nativeDesc})` : error.message;
}

export function describeAudioFailure({ state, waitedMs, timedOut, resumeError, sessionError }: AudioFailureFacts): string {
  const parts = [`Audio is ${state}`];
  if (timedOut) parts.push(`still starting after ${waitedMs} ms`);
  if (resumeError !== null) parts.push(`resume failed: ${resumeError}`);
  if (sessionError !== null) parts.push(`audio session: ${sessionError}`);
  const text = parts.join(". ");
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
}
