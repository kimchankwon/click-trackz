export type DevLoginEnv = {
  DEV_LOGIN_SECRET?: string;
  DEV_LOGIN_DEPLOYMENT?: string;
  CONVEX_CLOUD_URL?: string;
};

export const devLoginEnabled = (env: DevLoginEnv) =>
  Boolean(env.DEV_LOGIN_SECRET) && Boolean(env.DEV_LOGIN_DEPLOYMENT) && env.DEV_LOGIN_DEPLOYMENT === env.CONVEX_CLOUD_URL;

export function secretsMatch(given: string, expected: string) {
  const length = Math.max(given.length, expected.length);
  let difference = given.length ^ expected.length;
  for (let index = 0; index < length; index++) {
    difference |= (given.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}
