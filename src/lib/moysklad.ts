import type { MsMeta } from "@/lib/ms-types";

const BASE_URL = "https://api.moysklad.ru/api/remap/1.2";

export class MoySkladError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "MoySkladError";
  }
}

async function msRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json;charset=utf-8",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let details = "";
    try {
      const body = await res.json();
      details = body?.errors?.map((e: { error?: string }) => e.error).join("; ") ?? JSON.stringify(body);
    } catch {
      details = await res.text().catch(() => "");
    }
    throw new MoySkladError(
      `МойСклад API ${res.status}: ${details || res.statusText}`,
      res.status,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export interface MsRow {
  id: string;
  meta: MsMeta;
  name: string;
  code?: string;
  article?: string;
  pathName?: string;
  archived?: boolean;
  uom?: { name?: string };
  barcodes?: Array<Record<string, string>>;
  salePrices?: Array<{ value: number; currency?: MsMeta }>;
  stock?: number;
  quantity?: number;
  reserve?: number;
}

interface MsListResponse<T> {
  rows: T[];
  meta: { size: number; limit: number; offset: number };
}

export function flattenBarcodes(barcodes?: Array<Record<string, string>>): string[] {
  if (!barcodes || !Array.isArray(barcodes)) return [];
  const result: string[] = [];
  for (const entry of barcodes) {
    const values = Object.values(entry).filter((v) => typeof v === "string" && v.length > 0);
    if (values.length > 0) result.push(values.join(""));
  }
  return result;
}

export function extractIdFromHref(href: string): string {
  const parts = href.split("/").filter(Boolean);
  return parts[parts.length - 1]?.split("?")[0] ?? "";
}

export async function testConnection(token: string): Promise<{ accountName: string }> {
  const data = await msRequest<{ rows: Array<{ name?: string }> }>(
    token,
    "/entity/organization?limit=1",
  );
  return { accountName: data.rows[0]?.name ?? "МойСклад" };
}

export async function listOrganizations(token: string) {
  const data = await msRequest<MsListResponse<MsRow>>(token, "/entity/organization?limit=100");
  return data.rows.map((r) => ({ id: r.id, name: r.name, meta: r.meta }));
}

export async function listStores(token: string) {
  const data = await msRequest<MsListResponse<MsRow>>(token, "/entity/store?limit=100");
  return data.rows.map((r) => ({ id: r.id, name: r.name, meta: r.meta }));
}

export interface NormalizedProduct {
  msId: string;
  msType: string;
  name: string;
  code: string | null;
  article: string | null;
  barcodes: string[];
  pathName: string | null;
  uom: string | null;
  salePrice: number | null;
  systemStock: number;
  archived: boolean;
  meta: MsMeta;
}

const PAGE_LIMIT = 1000;

/**
 * Загружает весь ассортимент (товары/модификации/комплекты) постранично.
 * Если передан storeHref, остатки считаются только по указанному складу.
 */
export async function fetchAllAssortment(
  token: string,
  options: { storeHref?: string; onProgress?: (loaded: number, total: number) => void } = {},
): Promise<NormalizedProduct[]> {
  const result: NormalizedProduct[] = [];
  let offset = 0;
  let total = Infinity;

  const filterParts = ["filter=type=product", "filter=type=variant", "filter=type=bundle", "filter=archived=false"];
  if (options.storeHref) {
    filterParts.push(`stockStore=${encodeURIComponent(options.storeHref)}`);
  }

  while (offset < total) {
    const query = `${filterParts.join("&")}&limit=${PAGE_LIMIT}&offset=${offset}`;
    const data = await msRequest<MsListResponse<MsRow>>(token, `/entity/assortment?${query}`);
    total = data.meta.size;

    for (const row of data.rows) {
      result.push({
        msId: row.id,
        msType: row.meta.type,
        name: row.name,
        code: row.code ?? null,
        article: row.article ?? null,
        barcodes: flattenBarcodes(row.barcodes),
        pathName: row.pathName ?? null,
        uom: row.uom?.name ?? null,
        salePrice: row.salePrices?.[0]?.value != null ? row.salePrices[0].value / 100 : null,
        systemStock: typeof row.stock === "number" ? row.stock : 0,
        archived: row.archived ?? false,
        meta: row.meta,
      });
    }

    options.onProgress?.(result.length, total);
    offset += PAGE_LIMIT;
    if (data.rows.length === 0) break;
  }

  return result;
}

export interface InventoryPositionInput {
  assortmentMeta: MsMeta;
  quantity: number;
}

export async function createInventoryDocument(
  token: string,
  payload: {
    organizationMeta: MsMeta;
    storeMeta: MsMeta;
    name?: string;
    description?: string;
    applicable: boolean;
    positions: InventoryPositionInput[];
  },
): Promise<{ id: string; name: string }> {
  const body = {
    organization: { meta: payload.organizationMeta },
    store: { meta: payload.storeMeta },
    name: payload.name,
    description: payload.description,
    applicable: payload.applicable,
    positions: payload.positions.map((p) => ({
      quantity: p.quantity,
      assortment: { meta: p.assortmentMeta },
    })),
  };

  const data = await msRequest<{ id: string; name: string }>(token, "/entity/inventory", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { id: data.id, name: data.name };
}
