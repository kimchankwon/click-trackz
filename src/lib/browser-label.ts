const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, "Edge"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/Windows/, "Windows"],
  [/CrOS/, "Chromebook"],
  [/Linux/, "Linux"],
];

const firstMatch = (userAgent: string, table: readonly (readonly [RegExp, string])[]) => table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

export function browserLabel(userAgent: string): string {
  const browser = firstMatch(userAgent, BROWSERS) ?? "Browser";
  const system = firstMatch(userAgent, SYSTEMS);
  return system === null ? browser : `${browser} on ${system}`;
}
