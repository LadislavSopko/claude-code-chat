interface ClientEntry {
  readonly name: string;
  readonly apiKeyId: string;
  ws: unknown;
}

interface RoomMember {
  readonly name: string;
  role: string;
}

const clientsByName = new Map<string, ClientEntry>();
const roomMembers = new Map<string, Map<string, RoomMember>>();

export function registerClient(ws: unknown, name: string, apiKeyId: string): void {
  clientsByName.set(name, { name, apiKeyId, ws });
}

export function updateClientWs(name: string, ws: unknown): void {
  const entry = clientsByName.get(name);
  if (entry) entry.ws = ws;
}

export function unregisterClient(name: string): void {
  clientsByName.delete(name);
  for (const [roomId, members] of roomMembers) {
    members.delete(name);
    if (members.size === 0) {
      roomMembers.delete(roomId);
    }
  }
}

export function addToRoom(name: string, roomId: string, role: string): void {
  if (!roomMembers.has(roomId)) {
    roomMembers.set(roomId, new Map());
  }
  roomMembers.get(roomId)!.set(name, { name, role });
}

export function removeFromRoom(name: string, roomId: string): void {
  roomMembers.get(roomId)?.delete(name);
}

export function broadcastToRoom(
  roomId: string,
  msg: object,
  excludeName?: string,
  filter?: (memberName: string) => boolean,
): void {
  const data = JSON.stringify(msg);
  const members = roomMembers.get(roomId);
  if (!members) return;
  for (const [memberName] of members) {
    if (memberName === excludeName) continue;
    if (filter && !filter(memberName)) continue;
    const entry = clientsByName.get(memberName);
    if (entry?.ws) {
      (entry.ws as { send(data: string): void }).send(data);
    }
  }
}

export function getRoomMemberNames(roomId: string): string[] {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  return [...members.keys()];
}

export function getRoomMemberRoles(roomId: string): Array<{ name: string; role: string }> {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  return [...members.values()].map(m => ({ name: m.name, role: m.role }));
}

export function getOwnerNames(roomId: string): string[] {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  return [...members.values()].filter(m => m.role === "OWNER").map(m => m.name);
}
