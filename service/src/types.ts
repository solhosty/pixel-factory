export type FolderState = 'available' | 'unavailable';

export interface ApiError {
  error: { code: string; message: string; details: Record<string, unknown>; request_id: string };
}

export class ServiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly details: Record<string, unknown> = {}, public readonly status = 400) {
    super(message);
  }
}
