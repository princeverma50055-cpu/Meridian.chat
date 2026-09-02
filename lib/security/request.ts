import {
  randomUUID
} from 'node:crypto';

export function getRequestId(
  request: Request
) {
  const existing =
    request.headers
      .get('x-request-id')
      ?.trim();

  if (
    existing &&
    /^[a-zA-Z0-9._:-]{1,100}$/.test(
      existing
    )
  ) {
    return existing;
  }

  return randomUUID();
}

export function getClientIp(
  request: Request
) {
  const forwarded =
    request.headers
      .get('x-forwarded-for');

  if (forwarded) {
    const first =
      forwarded
        .split(',')
        .map(
          value =>
            value.trim()
        )
        .find(Boolean);

    if (first) {
      return first.slice(
        0,
        100
      );
    }
  }

  return (
    request.headers
      .get('x-real-ip')
      ?.trim()
      .slice(0, 100) ||
    'unknown'
  );
}

export function getUserAgent(
  request: Request
) {
  return (
    request.headers
      .get('user-agent')
      ?.slice(0, 500) ||
    'unknown'
  );
}
