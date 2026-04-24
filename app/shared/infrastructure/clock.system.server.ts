import type { Clock } from "../ports/clock.port";

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
