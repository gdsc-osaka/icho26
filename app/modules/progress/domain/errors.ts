export const DomainErrorCode = {
  INVALID_STAGE_TRANSITION: "INVALID_STAGE_TRANSITION",
  SUBQUESTION_NOT_UNLOCKED: "SUBQUESTION_NOT_UNLOCKED",
  INVALID_CHECKPOINT_CODE: "INVALID_CHECKPOINT_CODE",
  ANSWER_INCORRECT: "ANSWER_INCORRECT",
  EPILOGUE_NOT_ALLOWED: "EPILOGUE_NOT_ALLOWED",
} as const;

export type DomainErrorCode =
  (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}
