import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { inventorySessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import SessionActions from "@/components/SessionActions";
import SessionTabs from "@/components/SessionTabs";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Идёт подсчёт", className: "bg-amber-100 text-amber-800" },
  completed: { label: "Завершена", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Отменена", className: "bg-slate-200 text-slate-600" },
};

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (Number.isNaN(sessionId)) notFound();

  const [session] = await db.select().from(inventorySessions).where(eq(inventorySessions.id, sessionId)).limit(1);
  if (!session) notFound();

  const status = statusLabels[session.status] ?? statusLabels.active;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Все сессии
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{session.name}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {session.storeName ? `Склад: ${session.storeName} · ` : ""}
          {session.organizationName ? `Организация: ${session.organizationName} · ` : ""}
          Создана {new Date(session.createdAt).toLocaleString("ru-RU")}
        </p>
      </div>

      <SessionActions
        session={{
          id: session.id,
          name: session.name,
          status: session.status as "active" | "completed" | "cancelled",
          storeId: session.storeId,
          storeName: session.storeName,
          organizationId: session.organizationId,
          organizationName: session.organizationName,
          createdAt: session.createdAt.toISOString(),
          completedAt: session.completedAt ? session.completedAt.toISOString() : null,
          pushedAt: session.pushedAt ? session.pushedAt.toISOString() : null,
          pushedDocId: session.pushedDocId,
          pushedDocName: session.pushedDocName,
          note: session.note,
        }}
      />

      <SessionTabs sessionId={session.id} readOnly={session.status !== "active"} />
    </div>
  );
}
