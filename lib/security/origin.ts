export function getOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')?.trim();

  if (origin) {
    return origin;
  }

  const referer = request.headers.get('referer')?.trim();

  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function isSameOrigin(
  request: Request
): boolean {
  const origin = request.headers.get('origin')?.trim();

  if (!origin) {
    return true;
  }

  const host = request.headers.get('host')?.trim();

  if (!host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);

    return (
      originUrl.host === host &&
      (originUrl.protocol === 'https:' ||
        originUrl.protocol === 'http:')
    );
  } catch {
    return false;
  }
}

export function requireSameOrigin(
  request: Request
): void {
  if (!isSameOrigin(request)) {
    throw new Error('Invalid request origin.');
  }
}
