export type { IEntity } from "./interfaces/entity";

export { ErrorCode } from "./errors/error-code";
export type { AppError, Result } from "./errors/app-error";
export { ok, fail } from "./errors/app-error";

export { MessageType, RoomStatus, ParticipantRole, AuthProvider } from "./models/enums";
export type { MessageDto, RoomDto, ParticipantDto, HealthDto } from "./models/dtos";
