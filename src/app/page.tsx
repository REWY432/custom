import Link from "next/link";
import { db } from "@/db";
import { inventorySessions, products, sessionItems } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import NewSessionButton from "@/components/NewSessionButton";
import SyncButton from "@/components/SyncButton";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Идёт подсчёт", className: "bg-amber-100 text-amber-800" },
  completed: { label: "Завершена", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Отменена", className: "bg-slate-200 text-slate-600" },
};

export default async function HomePage() {
  const settings = await getSettings();

  const [{ totalProducts }] = await db
    .select({ totalProducts: sql<number>`count(*)::int` })
    .from(products);

  const sessions = await db
    .select({
      id: inventorySessions.id,
      name: inventorySessions.name,
      status: inventorySessions.status,
      storeName: inventorySessions.storeName,
      createdAt: inventorySessions.createdAt,
      pushedAt: inventorySessions.pushedAt,
      countedItems: sql<number>`count(distinct ${sessionItems.productId})::int`,
    })
    .from(inventorySessions)
    .leftJoin(sessionItems, eq(sessionItems.sessionId, inventorySessions.id))
    .groupBy(inventorySessions.id)
    .orderBy(desc(inventorySessions.createdAt));

  const configured = Boolean(settings?.apiToken);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">МойСклад</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Быстрая инвентаризация</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Загружаем весь ассортимент из МойСклад один раз, а затем считаем товары с телефона: поиск, сканер
              штрихкода, работа нескольких человек одновременно — и в конце одним нажатием отправляем результат
              обратно документом «Инвентаризация».
            </p>
          </div>
          {!configured && (
            <Link
              href="/settings"
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
            >
              Подключить МойСклад
            </Link>
          )}
        </div>

        {configured && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Аккаунт" value={settings?.accountName ?? "—"} />
            <Stat label="Товаров в базе" value={String(totalProducts)} />
            <Stat
              label="Последняя синхронизация"
              value={settings?.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString("ru-RU") : "не было"}
            />
            <Stat label="Склад по умолчанию" value={settings?.storeName ?? "не выбран"} />
          </div>
        )}

        {configured && (
          <div className="mt-5 flex flex-wrap gap-3">
            <SyncButton />
            <Link
              href="/settings"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Настройки подключения
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Сессии инвентаризации</h2>
          <NewSessionButton disabled={!configured || totalProducts === 0} />
        </div>

        {totalProducts === 0 && configured && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Сначала выполните синхронизацию товаров, чтобы можно было начать подсчёт.
          </p>
        )}

        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Пока нет ни одной сессии. Создайте первую, чтобы начать счёт.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {sessions.map((s) => {
              const pct = totalProducts > 0 ? Math.min(100, Math.round((s.countedItems / totalProducts) * 100)) : 0;
              const status = statusLabels[s.status] ?? statusLabels.active;
              return (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        {s.pushedAt && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            отправлено в МойСклад
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {s.storeName ? `Склад: ${s.storeName} · ` : ""}
                        {new Date(s.createdAt).toLocaleString("ru-RU")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:w-64">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-xs font-medium text-slate-600">
                        {s.countedItems}/{totalProducts}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
