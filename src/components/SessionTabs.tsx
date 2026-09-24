"use client";

import { useState } from "react";
import CountWorkspace from "@/components/CountWorkspace";
import ReportPanel from "@/components/ReportPanel";

export default function SessionTabs({ sessionId, readOnly }: { sessionId: number; readOnly: boolean }) {
  const [tab, setTab] = useState<"count" | "report">("count");

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-200/60 p-1 text-sm font-medium">
        <button
          onClick={() => setTab("count")}
          className={`flex-1 rounded-lg py-2 ${tab === "count" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
        >
          Подсчёт
        </button>
        <button
          onClick={() => setTab("report")}
          className={`flex-1 rounded-lg py-2 ${tab === "report" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
        >
          Отчёт
        </button>
      </div>

      {tab === "count" ? (
        <CountWorkspace sessionId={sessionId} readOnly={readOnly} />
      ) : (
        <ReportPanel sessionId={sessionId} />
      )}
    </div>
  );
}
