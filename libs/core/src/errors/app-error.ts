import { ErrorCode } from "./error-code";

export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly suggestion?: string;
}

export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T>(code: ErrorCode, message: string, suggestion?: string): Result<T> {
  return { ok: false, error: { code, message, suggestion } };
}
