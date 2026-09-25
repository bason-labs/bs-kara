// Response contract of GET /api/room-access, shared by the route and the phone-side hooks.
export type RoomAccessReason =
  | 'ok'
  | 'room_not_found'
  | 'subscription_expired';

export interface RoomAccessResponse {
  allowed: boolean;
  reason: RoomAccessReason;
}
