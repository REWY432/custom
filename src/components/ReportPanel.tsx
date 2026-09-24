"use client";

import { useEffect, useState } from "react";

interface ReportRow {
  productId: number;
  name: string;
  code: string | null;
  article: string | null;
  pathName: string | null;
  uom: string | null;
  salePrice: number | null;
  systemStock: number;
  countedQuantity: number;
  diff: number;
  diffValue: number;
  lastCountedBy: string | null;
}

interface Summary {
  totalProducts: number;
  counted: number;
  uncounted: number;
  surplusCount: number;
  shortageCount: number;
  matchedCount: number;
  surplusValue: number;
  shortageValue: number;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export default function ReportPanel({ sessionId }: { sessionId: number }) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/report`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.report ?? []);
        setSummary(d.summary ?? null);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const visible = onlyDiff ? rows.filter((r) => r.diff !== 0) : rows;
  const sorted = [...visible].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (loading) return <p className="text-sm text-slate-500">Загрузка отчёта...</p>;

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryCard label="Товаров всего" value={String(summary.totalProducts)} />
          <SummaryCard label="Не посчитано" value={String(summary.uncounted)} tone="warn" />
          <SummaryCard label="Совпало" value={String(summary.matchedCount)} tone="ok" />
          <SummaryCard label="Излишки" value={`${summary.surplusCount} · ${summary.surplusValue.toFixed(0)} ₽`} tone="info" />
          <SummaryCard label="Недостача" value={`${summary.shortageCount} · ${Math.abs(summary.shortageValue).toFixed(0)} ₽`} tone="bad" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          Только расхождения
        </label>
        <a
          href={`/api/sessions/${sessionId}/export`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ⬇ Экспорт в CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="p-3">Товар</th>
              <th className="p-3">Система</th>
              <th className="p-3">Факт</th>
              <th className="p-3">Отклонение</th>
              <th className="p-3">Сумма</th>
              <th className="p-3">Считал</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.productId} className="border-b border-slate-50 last:border-0">
                <td className="p-3">
                  <div className="font-medium text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">
                    {[r.article && `арт. ${r.article}`, r.pathName].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="p-3">{fmt(r.systemStock)}</td>
                <td className="p-3 font-semibold">{fmt(r.countedQuantity)}</td>
                <td className={`p-3 font-semibold ${r.diff > 0 ? "text-sky-600" : r.diff < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {r.diff > 0 ? "+" : ""}
                  {fmt(r.diff)}
                </td>
                <td className="p-3">{r.diffValue ? `${r.diffValue.toFixed(0)} ₽` : "—"}</td>
                <td className="p-3 text-xs text-slate-500">{r.lastCountedBy ?? "—"}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-slate-500">
                  Нет данных для отображения
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" | "info" }) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : tone === "info"
            ? "text-sky-700"
            : "text-slate-900";
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
