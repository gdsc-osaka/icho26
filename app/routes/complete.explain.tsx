import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Icon, PageShell, StageHeader, SystemPanel } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/complete.explain";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Explain() {
  const { t } = useTranslation();
  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader
        title={t("explain.stageTitle")}
        eyebrow={t("explain.stageEyebrow")}
      >
        <p>{t("explain.intro")}</p>
      </StageHeader>

      <SystemPanel className="my-8">
        <div className="mb-3 flex items-center gap-2 text-cyan-400">
          <Icon name="psychology" className="text-sm" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            SYSTEM_NOTE
          </span>
        </div>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          {t("explain.placeholder")}
        </p>
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
