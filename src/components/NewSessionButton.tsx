import Link from "next/link";

export default function NewSessionButton({ disabled }: { disabled?: boolean }) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
        + Новая сессия
      </span>
    );
  }

  return (
    <Link
      href="/sessions/new"
      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
    >
      + Новая сессия
    </Link>
  );
}
