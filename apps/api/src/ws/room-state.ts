interface ClientEntry {
  readonly name: string;
  readonly apiKeyId: string;
  ws: unknown;
}

const clientsByName = new Map<string, ClientEntry>();
const roomMembers = new Map<string, Set<string>>();

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

export function addToRoom(name: string, roomId: string): void {
  if (!roomMembers.has(roomId)) {
    roomMembers.set(roomId, new Set());
  }
  roomMembers.get(roomId)!.add(name);
}

export function removeFromRoom(name: string, roomId: string): void {
  roomMembers.get(roomId)?.delete(name);
}

export function broadcastToRoom(roomId: string, msg: object, excludeName?: string): void {
  const data = JSON.stringify(msg);
  const members = roomMembers.get(roomId);
  if (!members) return;
  for (const memberName of members) {
    if (memberName !== excludeName) {
      const entry = clientsByName.get(memberName);
      if (entry?.ws) {
        (entry.ws as { send(data: string): void }).send(data);
      }
    }
  }
}

export function getRoomMemberNames(roomId: string): string[] {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  return [...members];
}
