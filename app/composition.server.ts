import type { AppEnv } from "~/workers/bindings/env";
import { SystemClock } from "~/shared/infrastructure/clock.system.server";
import { UuidIdGenerator } from "~/shared/infrastructure/id-generator.uuid.server";
import type { Clock } from "~/shared/ports/clock.port";
import type { IdGenerator } from "~/shared/ports/id-generator.port";

export interface AppContainer {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly env: AppEnv;
}

export function getContainer(env: AppEnv): AppContainer {
  return {
    clock: new SystemClock(),
    idGenerator: new UuidIdGenerator(),
    env,
  };
}
