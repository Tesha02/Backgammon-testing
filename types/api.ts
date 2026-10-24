export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  active: boolean;
  wins: number;
  losses: number;
  rating: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface ErrorResponse {
  message: string;
}

export interface CreateRoomRequest {
  name: string;
}

export interface RoomResponse {
  id: number;
  name: string;
  status: 'WAITING' | 'PLAYING' | 'CLOSED';
  playerCount: number;
  createdAt: string;
  gameId: number | null;
}

export interface RoomPlayerResponse {
  id: number;
  roomId: number;
  userId: number;
  username: string;
  host: boolean;
  joinedAt: string;
}

export interface RoomDetailsResponse extends RoomResponse {
  maxPlayers: number;
  players: RoomPlayerResponse[];
}

export interface GameState {
  points: number[];
  whiteBar: number;
  blackBar: number;
  whiteOff: number;
  blackOff: number;
  dice: number[];
}

export interface GamePlayerResponse {
  id: number;
  gameId: number;
  userId: number;
  username: string;
  color: 'WHITE' | 'BLACK';
  winner: boolean;
}

export interface LegalMoveResponse {
  fromPosition: number;
  toPosition: number;
  diceValue: number;
}

export interface MoveResponse extends LegalMoveResponse {
  id: number;
  gameId: number;
  gamePlayerId: number;
  turnNumber: number;
  moveNumber: number;
  createdAt: string;
}

export interface GameResponse {
  id: number;
  roomId: number;
  status: 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';
  currentTurnUserId: number | null;
  currentState: GameState;
  turnNumber: number;
  turnDeadline: string | null;
  startedAt: string;
  finishedAt: string | null;
  openingWhiteDie: number | null;
  openingBlackDie: number | null;
}

export interface LeaderboardEntryResponse {
  rank: number;
  userId: number;
  username: string;
  rating: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
