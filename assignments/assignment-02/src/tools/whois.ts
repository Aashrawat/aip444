import whoiser from 'whoiser';

import { debugLog } from '../lib/logger.js';

export type WhoisResult = {
  ok: boolean;
  domain: string;
  registrant_organization: string | null;
  registration_date: string | null;
  expiration_date: string | null;
  registrar: string | null;
  country: string | null;
  raw_summary: string;
  error?: string;
};

function pickString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

function flattenWhois(data: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(data);
  if (keys.length === 1 && typeof data[keys[0]] === 'object' && data[keys[0]] !== null) {
    return data[keys[0]] as Record<string, unknown>;
  }
  return data;
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 32);
  return d.toISOString().slice(0, 10);
}

async function rdapLookup(domain: string): Promise<Partial<WhoisResult>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/rdap+json, application/json' },
    });
    if (!res.ok) {
      return { error: `RDAP HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      entities?: Array<{
        roles?: string[];
        vcardArray?: unknown[];
      }>;
      events?: Array<{ eventAction?: string; eventDate?: string }>;
      ldhName?: string;
    };

    let registration_date: string | null = null;
    let expiration_date: string | null = null;
    for (const ev of data.events ?? []) {
      if (ev.eventAction === 'registration') {
        registration_date = normalizeDate(ev.eventDate ?? null);
      }
      if (ev.eventAction === 'expiration') {
        expiration_date = normalizeDate(ev.eventDate ?? null);
      }
    }

    let registrar: string | null = null;
    let registrant_organization: string | null = null;
    for (const ent of data.entities ?? []) {
      const roles = ent.roles ?? [];
      const fn = extractVcardFn(ent.vcardArray);
      if (roles.includes('registrar') && fn) registrar = fn;
      if (roles.includes('registrant') && fn) registrant_organization = fn;
    }

    return {
      ok: true,
      registration_date,
      expiration_date,
      registrar,
      registrant_organization,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `RDAP failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function extractVcardFn(vcardArray: unknown[] | undefined): string | null {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2) return null;
  const cards = vcardArray[1];
  if (!Array.isArray(cards)) return null;
  for (const row of cards) {
    if (Array.isArray(row) && row[0] === 'fn' && typeof row[3] === 'string') {
      return row[3];
    }
  }
  return null;
}

export async function whoisLookup(domain: string): Promise<WhoisResult> {
  const cleaned = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

  debugLog(`Tool call: whois_lookup("${cleaned}")`);

  let registration_date: string | null = null;
  let expiration_date: string | null = null;
  let registrar: string | null = null;
  let registrant_organization: string | null = null;
  let country: string | null = null;
  const errors: string[] = [];

  try {
    const raw = (await whoiser(cleaned, { timeout: 10_000 })) as Record<
      string,
      unknown
    >;
    const info = flattenWhois(raw);

    registrant_organization =
      pickString(info['Registrant Organization']) ||
      pickString(info['Registrant']) ||
      pickString(info['Org']) ||
      pickString(info['Organization']);

    registration_date = normalizeDate(
      pickString(info['Creation Date']) ||
        pickString(info['Created Date']) ||
        pickString(info['Registered On']) ||
        pickString(info['created'])
    );

    expiration_date = normalizeDate(
      pickString(info['Registry Expiry Date']) ||
        pickString(info['Registrar Registration Expiration Date']) ||
        pickString(info['Expiry Date']) ||
        pickString(info['Expires On']) ||
        pickString(info['expires'])
    );

    registrar =
      pickString(info['Registrar']) || pickString(info['Sponsoring Registrar']);

    country =
      pickString(info['Registrant Country']) || pickString(info['Country']);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`WHOIS: ${message}`);
  }

  if (!registration_date) {
    debugLog(`WHOIS incomplete for ${cleaned}; trying RDAP fallback`);
    const rdap = await rdapLookup(cleaned);
    if (rdap.registration_date) registration_date = rdap.registration_date;
    if (!expiration_date && rdap.expiration_date) {
      expiration_date = rdap.expiration_date;
    }
    if (!registrar && rdap.registrar) registrar = rdap.registrar;
    if (!registrant_organization && rdap.registrant_organization) {
      registrant_organization = rdap.registrant_organization;
    }
    if (rdap.error) errors.push(rdap.error);
  }

  const summaryParts = [
    registration_date ? `registered ${registration_date}` : 'registration date unknown',
    registrar ? `registrar: ${registrar}` : null,
    expiration_date ? `expires ${expiration_date}` : null,
    registrant_organization
      ? `org: ${registrant_organization}`
      : 'org redacted/unavailable',
  ].filter(Boolean);

  debugLog(`WHOIS: ${summaryParts.join(', ')}`);

  const ok = Boolean(registration_date || registrar || registrant_organization);
  return {
    ok,
    domain: cleaned,
    registrant_organization,
    registration_date,
    expiration_date,
    registrar,
    country,
    raw_summary: summaryParts.join('; '),
    error: ok ? undefined : errors.join('; ') || 'No registration data found',
  };
}

export const whoisToolDef = {
  type: 'function' as const,
  function: {
    name: 'whois_lookup',
    description:
      'Look up WHOIS/RDAP domain registration data for a company domain (e.g. acmecorp.com). Returns registration date, registrar, org if available. Privacy services often redact registrant fields but registration date usually remains.',
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name without path, e.g. acmecorp.com',
        },
      },
      required: ['domain'],
      additionalProperties: false,
    },
  },
};
