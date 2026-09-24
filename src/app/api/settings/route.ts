import { getSettings, upsertSettings } from "@/lib/settings";
import { testConnection } from "@/lib/moysklad";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  if (!s) {
    return Response.json({ configured: false });
  }
  return Response.json({
    configured: Boolean(s.apiToken),
    accountName: s.accountName,
    organizationId: s.organizationId,
    organizationName: s.organizationName,
    storeId: s.storeId,
    storeName: s.storeName,
    lastSyncAt: s.lastSyncAt,
    lastSyncCount: s.lastSyncCount,
    hasToken: Boolean(s.apiToken),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const token = typeof body.apiToken === "string" ? body.apiToken.trim() : undefined;

  if (token) {
    try {
      const { accountName } = await testConnection(token);
      const updated = await upsertSettings({ apiToken: token, accountName });
      return Response.json({ ok: true, accountName: updated.accountName });
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : "Не удалось подключиться к МойСклад" },
        { status: 400 },
      );
    }
  }

  if (body.organization || body.store) {
    const patch: Record<string, unknown> = {};
    if (body.organization) {
      patch.organizationId = body.organization.id;
      patch.organizationName = body.organization.name;
      patch.organizationMeta = body.organization.meta;
    }
    if (body.store) {
      patch.storeId = body.store.id;
      patch.storeName = body.store.name;
      patch.storeMeta = body.store.meta;
    }
    const updated = await upsertSettings(patch);
    return Response.json({ ok: true, organizationName: updated.organizationName, storeName: updated.storeName });
  }

  return Response.json({ ok: false, error: "Нет данных для сохранения" }, { status: 400 });
}
