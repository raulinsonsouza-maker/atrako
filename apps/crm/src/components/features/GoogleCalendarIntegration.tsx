"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  disconnectCalendar,
  getUserCalendarConnection,
  listUserCalendars,
  setUserCalendarId,
} from "@/server/actions/calendar";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/design/components";

type CalendarItem = {
  id?: string | null;
  summary?: string | null;
  primary?: boolean | null;
};

export function GoogleCalendarIntegration({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof getUserCalendarConnection>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [saving, setSaving] = useState(false);

  const connectUrl = useMemo(() => {
    const returnTo = pathname || "/dashboard/configuracoes";
    return `/api/integrations/google-calendar/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
  }, [pathname]);

  useEffect(() => {
    getUserCalendarConnection(tenantId)
      .then((conn) => setConnection(conn))
      .finally(() => setLoading(false));
  }, [tenantId]);

  async function loadCalendars() {
    setLoadingCalendars(true);
    try {
      const items = await listUserCalendars(tenantId);
      setCalendars(items as CalendarItem[]);
    } finally {
      setLoadingCalendars(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-neutral-500">Carregando integração…</p>
        ) : connection ? (
          <>
            <p className="text-sm text-neutral-600">
              Conectado ao calendário: <span className="font-medium">{connection.calendarId}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  setSaving(true);
                  await disconnectCalendar(tenantId);
                  setConnection(null);
                  setCalendars([]);
                  setSaving(false);
                }}
                isLoading={saving}
              >
                Desconectar
              </Button>
              <Button variant="outline" onClick={loadCalendars} isLoading={loadingCalendars}>
                Atualizar calendários
              </Button>
            </div>
            {calendars.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Selecionar calendário
                </label>
                <select
                  className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                  defaultValue={connection.calendarId}
                  onChange={async (e) => {
                    const calendarId = e.target.value;
                    setSaving(true);
                    await setUserCalendarId(tenantId, calendarId);
                    setConnection((prev) => (prev ? { ...prev, calendarId } : prev));
                    setSaving(false);
                  }}
                >
                  {calendars.map((cal) => (
                    <option key={cal.id ?? ""} value={cal.id ?? ""}>
                      {cal.summary ?? cal.id}
                      {cal.primary ? " (principal)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              Conecte sua conta Google para sincronizar atendimentos com o Google Calendar.
            </p>
            <a href={connectUrl}>
              <Button>Conectar Google Calendar</Button>
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
