const JOIN_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizeJoinCode(value: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const code = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return JOIN_CODE.test(code) ? code : null;
}

export function inviteLink(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/join/${code}`;
}

export function inviteText(groupName: string): string {
  return `Join ${groupName} on Cue Tracker`;
}
