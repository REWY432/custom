import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Настройки подключения к МойСклад</h1>
      <p className="mt-2 text-sm text-slate-600">
        Токен создаётся в МойСклад: раздел <b>Настройки → Веб-версия → Безопасность → Токены для сторонних сервисов</b>{" "}
        (или «Настройки пользователя → API доступ»). Скопируйте токен и вставьте ниже — секрет хранится только в базе
        данных этого сервиса.
      </p>
      <SettingsForm />
    </div>
  );
}
