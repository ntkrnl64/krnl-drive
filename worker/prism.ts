import { PrismClient } from "@siiway/prism";
import { getSettings } from "./db.ts";
import type { Env } from "./types.ts";

export interface PrismConfig {
  enabled: boolean;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  autoProvision: boolean;
}

export async function loadPrismConfig(db: D1Database): Promise<PrismConfig> {
  const s = await getSettings(db);
  return {
    enabled: s.prism_enabled === "1",
    baseUrl: s.prism_base_url ?? "",
    clientId: s.prism_client_id ?? "",
    clientSecret: s.prism_client_secret ?? "",
    autoProvision: s.prism_auto_provision === "1",
  };
}

export function isPrismConfigured(cfg: PrismConfig): boolean {
  return cfg.enabled && !!cfg.baseUrl && !!cfg.clientId && !!cfg.clientSecret;
}

export function getRedirectUri(env: Env): string {
  return `${env.ORIGIN.replace(/\/+$/, "")}/api/auth/prism/callback`;
}

export function buildPrismClient(cfg: PrismConfig, env: Env): PrismClient {
  return new PrismClient({
    baseUrl: cfg.baseUrl,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    redirectUri: getRedirectUri(env),
    scopes: ["openid", "profile", "email"],
  });
}
