import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from "node:crypto";

/**
 * Verifies a Supabase access token signed with an asymmetric key (ES256) via the
 * project's JWKS endpoint. Uses only Node built-ins (no ESM-only jose dependency).
 */

interface Jwk extends JsonWebKey {
  kid?: string;
  alg?: string;
}

let cache: { url: string; keys: Jwk[] } | null = null;

async function fetchKeys(jwksUrl: string, force = false): Promise<Jwk[]> {
  if (!force && cache && cache.url === jwksUrl) return cache.keys;
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  cache = { url: jwksUrl, keys: body.keys ?? [] };
  return cache.keys;
}

function b64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface SupabaseClaims {
  sub: string;
  email?: string;
  exp?: number;
  user_metadata?: { restaurant_name?: string };
}

export async function verifySupabaseJwt(token: string, jwksUrl: string): Promise<SupabaseClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const header = JSON.parse(b64url(parts[0]).toString("utf8")) as { alg: string; kid?: string };
  const payload = JSON.parse(b64url(parts[1]).toString("utf8")) as SupabaseClaims;

  if (header.alg !== "ES256") throw new Error(`Unsupported alg ${header.alg}`);

  let keys = await fetchKeys(jwksUrl);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchKeys(jwksUrl, true); // key may have rotated
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error("Signing key not found");

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const ok = cryptoVerify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    b64url(parts[2]),
  );
  if (!ok) throw new Error("Invalid signature");
  if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error("Token expired");

  return payload;
}
