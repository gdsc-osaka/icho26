import { useTranslation } from "react-i18next";
import { Link, useLoaderData } from "react-router";
import { Icon, MonospaceLog, PageShell, SystemPanel } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/complete.report";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  return {
    groupName: user.groupName,
    reported: user.reportedAt !== null,
  };
}

export default function Report() {
  const { t } = useTranslation();
  const { groupName, reported } = useLoaderData<typeof loader>();
  return (
    <PageShell sessionId="ID: X-99">
      <section className="relative flex flex-col items-center py-8">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
          <Icon name="verified_user" className="text-[180px] text-cyan-400" />
        </div>
        <div className="relative z-10 space-y-3 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-cyan-400">
            STATUS
          </p>
          <SystemPanel className="inline-block px-12 py-6">
            <h2 className="font-display text-3xl font-black uppercase tracking-widest text-cyan-400 drop-shadow-[0_0_15px_rgba(0,240,255,0.7)]">
              {reported ? "REPORTED" : "CLEARED"}
            </h2>
          </SystemPanel>
          <p className="font-mono text-sm uppercase tracking-widest text-cyan-400/80">
            {reported ? t("report.reportedLabel") : t("report.clearedLabel")}
          </p>
        </div>
      </section>

      <SystemPanel className="my-8">
        <div className="border-b border-cyan-500/20 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
            USER NAME
          </p>
          <MonospaceLog>{groupName ?? "—"}</MonospaceLog>
        </div>

        <div className="mt-4 border-l-4 border-cyan-400 bg-cyan-500/5 p-4">
          <p className="text-base leading-relaxed text-on-surface">
            {t("report.showStaff")}
          </p>
        </div>
      </SystemPanel>

      <Link
        to="/complete"
        className="inline-flex items-center gap-2 self-center font-mono text-xs uppercase tracking-widest text-cyan-400"
      >
        <Icon name="arrow_back" className="text-sm" />{" "}
        {t("common.backToCompleteHub")}
      </Link>
    </PageShell>
  );
}
