export enum MessageType {
  Text = "TEXT",
  System = "SYSTEM",
  Command = "COMMAND",
}

export enum RoomStatus {
  Active = "ACTIVE",
  Archived = "ARCHIVED",
}

export enum ParticipantRole {
  Owner = "OWNER",
  Human = "HUMAN",
  Agent = "AGENT",
  Member = "MEMBER",
  Observer = "OBSERVER",
}

export enum AuthProvider {
  Google = "GOOGLE",
}
