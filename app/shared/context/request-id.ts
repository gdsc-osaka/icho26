const REQUEST_ID_HEADER = "x-request-id";

export function getOrCreateRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing && isValidRequestId(existing)) {
    return existing;
  }
  return crypto.randomUUID();
}

function isValidRequestId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export { REQUEST_ID_HEADER };
