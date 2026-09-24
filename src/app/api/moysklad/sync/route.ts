import { db } from "@/db";
import { products } from "@/db/schema";
import { getSettings, upsertSettings } from "@/lib/settings";
import { fetchAllAssortment } from "@/lib/moysklad";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const settingsRow = await getSettings();
  if (!settingsRow?.apiToken) {
    return Response.json({ error: "Токен МойСклад не настроен" }, { status: 400 });
  }

  try {
    const storeHref = settingsRow.storeMeta?.href;
    const items = await fetchAllAssortment(settingsRow.apiToken, { storeHref });

    if (items.length === 0) {
      return Response.json({ error: "МойСклад вернул пустой ассортимент" }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .insert(products)
          .values({
            msId: item.msId,
            msType: item.msType,
            name: item.name,
            code: item.code,
            article: item.article,
            barcodes: item.barcodes,
            pathName: item.pathName,
            uom: item.uom,
            salePrice: item.salePrice,
            systemStock: item.systemStock,
            archived: item.archived,
            meta: item.meta,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: products.msId,
            set: {
              msType: item.msType,
              name: item.name,
              code: item.code,
              article: item.article,
              barcodes: item.barcodes,
              pathName: item.pathName,
              uom: item.uom,
              salePrice: item.salePrice,
              systemStock: item.systemStock,
              archived: item.archived,
              meta: item.meta,
              updatedAt: new Date(),
            },
          });
      }
    });

    await upsertSettings({ lastSyncAt: new Date(), lastSyncCount: items.length });

    const countResult = await db.execute<{ count: number }>(sql`select count(*)::int as count from ${products}`);
    const totalInDb = countResult.rows[0]?.count ?? items.length;

    return Response.json({ ok: true, synced: items.length, totalInDb });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Ошибка синхронизации с МойСклад" },
      { status: 500 },
    );
  }
}
