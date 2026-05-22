import type { MessageType, RoomStatus, ParticipantRole } from "./enums";

export interface MessageDto {
  readonly id: string;
  readonly roomId: string;
  readonly fromName: string;
  readonly toName?: string;
  readonly text: string;
  readonly type: MessageType;
  readonly createdAt: Date;
}

export interface RoomDto {
  readonly id: string;
  readonly name: string;
  readonly status: RoomStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ParticipantDto {
  readonly id: string;
  readonly name: string;
  readonly roomId: string;
  readonly role: ParticipantRole;
  readonly connectedAt: Date;
}

export interface HealthDto {
  readonly status: "ok";
  readonly version: string;
  readonly uptime: number;
}
