"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionInfo } from "@/lib/client-types";

export default function SessionActions({ session }: { session: SessionInfo }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applicable, setApplicable] = useState(true);

  const hasOrgStore = Boolean(session.organizationId && session.storeId);

  async function setStatus(status: string) {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Ошибка");
      else router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function handlePush() {
    setLoading("push");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicable }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить в МойСклад");
      } else {
        setMessage(`Документ «${data.doc.name}» создан в МойСклад`);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        {session.status === "active" && (
          <button
            onClick={() => setStatus("completed")}
            disabled={loading !== null}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading === "completed" ? "..." : "Завершить подсчёт"}
          </button>
        )}
        {session.status === "completed" && (
          <button
            onClick={() => setStatus("active")}
            disabled={loading !== null}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Возобновить подсчёт
          </button>
        )}
        <a
          href={`/api/sessions/${session.id}/export`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⬇ Экспорт CSV
        </a>

        {!session.pushedAt ? (
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" checked={applicable} onChange={(e) => setApplicable(e.target.checked)} />
              провести сразу
            </label>
            <button
              onClick={handlePush}
              disabled={loading !== null || !hasOrgStore}
              title={!hasOrgStore ? "Укажите организацию и склад для сессии" : ""}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading === "push" ? "Отправка..." : "Отправить в МойСклад"}
            </button>
          </div>
        ) : (
          <span className="ml-auto rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            Отправлено: {session.pushedDocName}
          </span>
        )}
      </div>
      {!hasOrgStore && !session.pushedAt && (
        <p className="text-xs text-amber-600">
          Для отправки документа в МойСклад укажите организацию и склад в настройках или при создании сессии.
        </p>
      )}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {message && <p className="text-xs font-medium text-emerald-600">{message}</p>}
    </div>
  );
}
