export function isSameOrigin(
  request: Request
) {
  const origin =
    request.headers
      .get('origin')
      ?.trim();

  if (!origin) {
    return true;
  }

  const host =
    request.headers
      .get('host')
      ?.trim();

  if (!host) {
    return false;
  }

  try {
    const url =
      new URL(origin);

    return (
      url.host === host &&
      (
        url.protocol ===
          'https:' ||
        url.protocol ===
          'http:'
      )
    );
  } catch {
    return false;
  }
}

export function requireSameOrigin(
  request: Request
) {
  if (
    !isSameOrigin(request)
  ) {
    throw new Error(
      'Invalid request origin.'
    );
  }
}
