import { Link, useLoaderData } from "react-router";
import { MonospaceLog, StageHeader, SystemPanel } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/complete.report";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  return {
    groupId: user.groupId,
    reported: user.reportedAt !== null,
  };
}

export default function Report() {
  const { groupId, reported } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="STAFF REPORT">
          <p>この画面をスタッフに見せて、景品を受け取ってください。</p>
        </StageHeader>
      </SystemPanel>

      <SystemPanel className="border-accent">
        <div className="space-y-3 text-center">
          <p className="font-mono text-text-secondary text-xs">GROUP ID</p>
          <MonospaceLog>{groupId}</MonospaceLog>
          <p
            className={`font-mono text-sm ${
              reported ? "text-accent" : "text-text-secondary"
            }`}
          >
            {reported ? "[ REPORTED ]" : "[ AWAITING STAFF ]"}
          </p>
        </div>
      </SystemPanel>

      <Link
        to="/complete"
        className="block text-center font-mono text-xs text-accent underline"
      >
        BACK TO COMPLETE HUB
      </Link>
    </main>
  );
}
