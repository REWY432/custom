"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionProductItem, SessionStats } from "@/lib/client-types";
import BarcodeScanner from "@/components/BarcodeScanner";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "uncounted", label: "Не считаны" },
  { key: "counted", label: "Считаны" },
  { key: "discrepancy", label: "Расхождения" },
];

function formatQty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export default function CountWorkspace({ sessionId, readOnly }: { sessionId: number; readOnly: boolean }) {
  const [countedBy, setCountedBy] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const [items, setItems] = useState<SessionProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [manualValue, setManualValue] = useState<string>("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const limit = 50;

  useEffect(() => {
    const saved = window.localStorage.getItem("inv_counted_by");
    if (saved) setCountedBy(saved);
  }, []);

  useEffect(() => {
    if (countedBy) window.localStorage.setItem("inv_counted_by", countedBy);
  }, [countedBy]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/products/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    if (res.ok) setStats(data.stats);
  }, [sessionId]);

  const fetchProducts = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: debouncedSearch,
          filter,
          category,
          limit: String(limit),
          offset: String(nextOffset),
        });
        const res = await fetch(`/api/sessions/${sessionId}/products?${params.toString()}`);
        const data = await res.json();
        if (res.ok) {
          setItems((prev) => (append ? [...prev, ...data.items] : data.items));
          setTotal(data.total);
          setOffset(nextOffset);
        }
      } finally {
        setLoading(false);
      }
    },
    [sessionId, debouncedSearch, filter, category],
  );

  useEffect(() => {
    fetchProducts(0, false);
  }, [fetchProducts]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function updateLocalItem(productId: number, countedQuantity: number, lastCountedBy: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === productId
          ? {
              ...it,
              countedQuantity,
              isCounted: true,
              diff: countedQuantity - it.systemStock,
              lastCountedBy,
              lastCountedAt: new Date().toISOString(),
            }
          : it,
      ),
    );
  }

  const submitCount = useCallback(
    async (productId: number, mode: "increment" | "set", value: number, source: "scan" | "manual") => {
      setBusyId(productId);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/count`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, mode, value, countedBy: countedBy || "Без имени", source }),
        });
        const data = await res.json();
        if (res.ok) {
          updateLocalItem(productId, data.countedQuantity, countedBy || "Без имени");
          fetchStats();
          return true;
        }
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [sessionId, countedBy, fetchStats],
  );

  async function handleUndo(productId: number) {
    setBusyId(productId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo", productId }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === productId
              ? {
                  ...it,
                  countedQuantity: data.countedQuantity,
                  isCounted: !data.removed,
                  diff: data.removed ? null : data.countedQuantity - it.systemStock,
                }
              : it,
          ),
        );
        fetchStats();
      }
    } finally {
      setBusyId(null);
    }
  }

  const scanLock = useRef(false);

  async function handleDetected(code: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    try {
      const params = new URLSearchParams({ q: code, filter: "all", category: "", limit: "5", offset: "0" });
      const res = await fetch(`/api/sessions/${sessionId}/products?${params.toString()}`);
      const data = await res.json();
      const matches: SessionProductItem[] = data.items ?? [];
      const exact = matches.filter((m) => m.barcodes.includes(code));
      const target = exact[0] ?? (matches.length === 1 ? matches[0] : null);

      if (!target) {
        setScanFeedback({ type: "error", text: `Товар со штрихкодом ${code} не найден` });
        return;
      }

      const ok = await submitCount(target.id, "increment", 1, "scan");
      setScanFeedback(
        ok
          ? { type: "ok", text: `+1 · ${target.name}` }
          : { type: "error", text: "Не удалось сохранить подсчёт" },
      );

      setItems((prev) => {
        if (prev.some((p) => p.id === target.id)) return prev;
        return [{ ...target, countedQuantity: (target.countedQuantity ?? 0) + 1, isCounted: true }, ...prev];
      });
    } finally {
      setTimeout(() => {
        scanLock.current = false;
      }, 900);
    }
  }

  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => setScanFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-700">
              Посчитано {stats.countedProducts} из {stats.totalProducts}
            </span>
            <span className="text-slate-500">
              Расхождений: <b className={stats.discrepancies > 0 ? "text-amber-600" : "text-emerald-600"}>{stats.discrepancies}</b>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${stats.totalProducts ? Math.min(100, (stats.countedProducts / stats.totalProducts) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={countedBy}
              onChange={(e) => setCountedBy(e.target.value)}
              placeholder="Ваше имя (кто считает)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
            />
            <button
              onClick={() => setScannerOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
            >
              📷 Сканировать штрихкод
            </button>
          </div>
          {scanFeedback && (
            <p className={`mt-2 text-sm font-medium ${scanFeedback.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {scanFeedback.text}
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию, артикулу, коду или штрихкоду..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ProductRow
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            busy={busyId === item.id}
            readOnly={readOnly}
            manualValue={activeId === item.id ? manualValue : ""}
            onToggle={() => {
              setActiveId(activeId === item.id ? null : item.id);
              setManualValue(item.isCounted ? formatQty(item.countedQuantity) : "");
            }}
            onManualChange={setManualValue}
            onIncrement={(delta) => submitCount(item.id, "increment", delta, "manual")}
            onSet={() => {
              const value = Number(manualValue.replace(",", "."));
              if (!Number.isNaN(value)) submitCount(item.id, "set", value, "manual");
            }}
            onUndo={() => handleUndo(item.id)}
          />
        ))}

        {items.length === 0 && !loading && (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Ничего не найдено по текущим фильтрам.
          </p>
        )}

        {items.length < total && (
          <button
            onClick={() => fetchProducts(offset + limit, true)}
            disabled={loading}
            className="mt-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Загрузка..." : `Показать ещё (${total - items.length})`}
          </button>
        )}
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

function ProductRow({
  item,
  isActive,
  busy,
  readOnly,
  manualValue,
  onToggle,
  onManualChange,
  onIncrement,
  onSet,
  onUndo,
}: {
  item: SessionProductItem;
  isActive: boolean;
  busy: boolean;
  readOnly: boolean;
  manualValue: string;
  onToggle: () => void;
  onManualChange: (v: string) => void;
  onIncrement: (delta: number) => void;
  onSet: () => void;
  onUndo: () => void;
}) {
  const diffBadge = !item.isCounted
    ? { text: "не считан", cls: "bg-slate-100 text-slate-500" }
    : item.diff === 0
      ? { text: "совпадает", cls: "bg-emerald-100 text-emerald-700" }
      : item.diff && item.diff > 0
        ? { text: `+${formatQty(item.diff)}`, cls: "bg-sky-100 text-sky-700" }
        : { text: formatQty(item.diff ?? 0), cls: "bg-red-100 text-red-700" };

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          <p className="truncate text-xs text-slate-500">
            {[item.article && `арт. ${item.article}`, item.code && `код ${item.code}`, item.pathName]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right text-xs text-slate-500">
            <div>система: {formatQty(item.systemStock)}</div>
            <div className="font-semibold text-slate-800">факт: {formatQty(item.countedQuantity)}</div>
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${diffBadge.cls}`}>{diffBadge.text}</span>
        </div>
      </button>

      {isActive && (
        <div className="border-t border-slate-100 p-3">
          {readOnly ? (
            <p className="text-xs text-slate-500">Сессия завершена, редактирование недоступно.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {[-1, 1, 5, 10].map((d) => (
                  <button
                    key={d}
                    disabled={busy}
                    onClick={() => onIncrement(d)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      d > 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-700 hover:bg-red-100"
                    } disabled:opacity-50`}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={manualValue}
                  onChange={(e) => onManualChange(e.target.value)}
                  inputMode="decimal"
                  placeholder="Точное количество"
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={onSet}
                  disabled={busy}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Установить точно
                </button>
                {item.isCounted && (
                  <button
                    onClick={onUndo}
                    disabled={busy}
                    className="ml-auto rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    ↩ Отменить последнее
                  </button>
                )}
              </div>
              {item.lastCountedBy && (
                <p className="mt-2 text-xs text-slate-400">
                  Последний раз считал(а): {item.lastCountedBy}
                  {item.lastCountedAt ? `, ${new Date(item.lastCountedAt).toLocaleTimeString("ru-RU")}` : ""}
                </p>
              )}
              {item.barcodes.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">Штрихкоды: {item.barcodes.join(", ")}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
