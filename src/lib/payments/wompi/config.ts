/**
 * Wompi credentials, parsed from env. The environment (sandbox or production) is derived from the
 * public key prefix and every other credential must agree with it, so a test key can never be mixed
 * with a production secret (or the other way round). Error messages never include secret values.
 */
export type WompiEnvironment = "test" | "prod";

export type WompiConfig = {
  environment: WompiEnvironment;
  apiBase: string;
  publicKey: string;
  privateKey: string;
  eventsSecret: string;
  integritySecret: string;
};

export type WompiConfigResult = { ok: true; config: WompiConfig } | { ok: false; error: string };

const API_BASE: Record<WompiEnvironment, string> = {
  test: "https://sandbox.wompi.co/v1",
  prod: "https://production.wompi.co/v1",
};

const SLOTS = [
  { env: "WOMPI_PUBLIC_KEY", pattern: /^pub_(test|prod)_\S+$/ },
  { env: "WOMPI_PRIVATE_KEY", pattern: /^prv_(test|prod)_\S+$/ },
  { env: "WOMPI_EVENTS_SECRET", pattern: /^(test|prod)_events_\S+$/ },
  { env: "WOMPI_INTEGRITY_SECRET", pattern: /^(test|prod)_integrity_\S+$/ },
] as const;

export function parseWompiConfig(env: Record<string, string | undefined>): WompiConfigResult {
  const values: Record<string, string> = {};
  const environments = new Set<string>();

  for (const slot of SLOTS) {
    const value = env[slot.env]?.trim();
    if (!value) return { ok: false, error: `${slot.env} is not set` };
    const match = slot.pattern.exec(value);
    if (!match) return { ok: false, error: `${slot.env} has an unexpected format (check the key prefix)` };
    values[slot.env] = value;
    environments.add(match[1]);
  }

  if (environments.size !== 1) {
    return { ok: false, error: "Wompi keys mix sandbox (test) and production (prod) credentials" };
  }
  const environment = [...environments][0] as WompiEnvironment;

  return {
    ok: true,
    config: {
      environment,
      apiBase: API_BASE[environment],
      publicKey: values.WOMPI_PUBLIC_KEY,
      privateKey: values.WOMPI_PRIVATE_KEY,
      eventsSecret: values.WOMPI_EVENTS_SECRET,
      integritySecret: values.WOMPI_INTEGRITY_SECRET,
    },
  };
}
