import type { IncomingMessage, ServerResponse } from 'node:http';
export function modelMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void;
