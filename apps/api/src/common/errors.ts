import { ErrorCode, type AppError } from "@claude-code-chat/core";

const STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.NotFound]: 404,
  [ErrorCode.InvalidParams]: 400,
  [ErrorCode.Unauthorized]: 401,
  [ErrorCode.Forbidden]: 403,
  [ErrorCode.Conflict]: 409,
  [ErrorCode.Timeout]: 408,
  [ErrorCode.InternalError]: 500,
};

export function errorToStatus(error: AppError): number {
  return STATUS_MAP[error.code] ?? 500;
}

export function appError(code: ErrorCode, message: string, suggestion?: string): AppError {
  return { code, message, suggestion };
}
