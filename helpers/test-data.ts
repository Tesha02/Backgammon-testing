import { randomUUID } from 'node:crypto';
import type { RegisterRequest } from '..\\types\\api';

export function newUserData(): RegisterRequest {
  const suffix = randomUUID().replaceAll('-', '');
  return {
    username: `api_${suffix}`,
    email: `api_${suffix}@example.test`,
    password: `Test_${randomUUID()}!`,
  };
}

export function newRoomName(): string {
  return `API room ${randomUUID()}`;
}
