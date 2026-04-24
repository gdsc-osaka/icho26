import type { IdGenerator } from "../ports/id-generator.port";

export class UuidIdGenerator implements IdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
