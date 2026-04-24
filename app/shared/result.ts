export type Result<T, E = Error> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.ok === false;
}

export function mapResult<T, U, E>(
  r: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return isOk(r) ? ok(fn(r.value)) : r;
}

export function flatMapResult<T, U, E>(
  r: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return isOk(r) ? fn(r.value) : r;
}
