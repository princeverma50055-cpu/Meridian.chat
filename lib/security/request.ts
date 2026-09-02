import { randomUUID } from 'node:crypto';

export function getRequestId(request: Request): string {
  const existing = request.headers.get('x-request-id')?.trim();

  if (existing && /^[a-zA-Z0-9._:-]{1,100}$/.test(existing)) {
    return existing;
  }

  return randomUUID();
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    const first = forwardedFor
      .split(',')
      .map(value => value.trim())
      .find(Boolean);

    if (first) return first.slice(0, 100);
  }

  const realIp = request.headers.get('x-real-ip')?.trim();

  if (realIp) {
    return realIp.slice(0, 100);
  }

  return 'unknown';
}

export function getUserAgent(request: Request): string {
  return (
    request.headers.get('user-agent')?.slice(0, 500) ||
    'unknown'
  );
}
