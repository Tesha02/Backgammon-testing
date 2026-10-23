import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { LoginRequest, RegisterRequest } from '..\\types\\api';

export class AuthApi {
  constructor(private readonly request: APIRequestContext) {}

  register(data: RegisterRequest): Promise<APIResponse> {
    return this.request.post('/auth/register', { data });
  }

  login(data: LoginRequest): Promise<APIResponse> {
    return this.request.post('/auth/login', { data });
  }

  me(): Promise<APIResponse> {
    return this.request.get('/auth/me');
  }
}
