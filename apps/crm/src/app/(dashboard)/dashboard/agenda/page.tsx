import Link from "next/link";
import { getDashboardContext } from "@/lib/dashboard-context";
import { getCalendarEmbedInfo } from "@/server/actions/calendar";
import { CalendarOff, Settings } from "lucide-react";

export default async function AgendaPage() {
  const { tenantId } = await getDashboardContext();
  const data = await getCalendarEmbedInfo(tenantId);

  if (!data.connected) {
    return (
      <div className="space-y-5">
        {/* Header: titulo "Agenda" no Header do layout */}
        <div>
          <p className="text-subhead text-neutral-500 dark:text-neutral-400">
            Gerencie seus compromissos
          </p>
        </div>

        {/* Card de conexao */}
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
            <CalendarOff className="h-8 w-8 text-neutral-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Google Calendar nao conectado
          </h3>
          <p className="text-footnote text-neutral-500 dark:text-neutral-400 mb-6 max-w-md text-center">
            Conecte sua conta do Google Calendar para visualizar e gerenciar seus compromissos diretamente no CRM.
          </p>
          <Link
            href="/dashboard/configuracoes"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-500 text-white text-footnote font-medium hover:bg-primary-600 transition-colors"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
            Conectar Google Calendar
          </Link>
        </div>
      </div>
    );
  }

  const calendarId = data.calendarId;
  
  // ALTERADO: mode=WEEK para exibicao semanal padrao (estilo Google Agenda)
  const embedUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
    calendarId
  )}&ctz=America%2FSao_Paulo&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showCalendars=0&showTz=0&wkst=1`;

  return (
    <div className="space-y-5">
      {/* Header: titulo "Agenda" no Header do layout */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-subhead text-neutral-500 dark:text-neutral-400">
            {calendarId}
          </p>
        </div>
        <Link
          href="/dashboard/configuracoes"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-footnote font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <Settings className="h-4 w-4" strokeWidth={1.75} />
          Configuracoes
        </Link>
      </div>

      {/* Calendario */}
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-card">
        <div className="h-[80vh] w-full">
          <iframe
            title="Agenda Google"
            src={embedUrl}
            className="h-full w-full"
            frameBorder="0"
            style={{ border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
