import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { CreateRoomRequest } from '..\\types\\api';

export class RoomsApi {
  constructor(private readonly request: APIRequestContext) {}

  list(): Promise<APIResponse> {
    return this.request.get('/api/rooms');
  }

  create(data: CreateRoomRequest): Promise<APIResponse> {
    return this.request.post('/api/rooms', { data });
  }

  details(roomId: number): Promise<APIResponse> {
    return this.request.get(`/api/rooms/${roomId}`);
  }

  current(): Promise<APIResponse> {
    return this.request.get('/api/rooms/current');
  }

  join(roomId: number): Promise<APIResponse> {
    return this.request.post(`/api/rooms/${roomId}/join`);
  }

  leave(roomId: number): Promise<APIResponse> {
    return this.request.post(`/api/rooms/${roomId}/leave`);
  }
}
