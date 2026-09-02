export type SecurityCheck = {
  name: string;
  status:
    | 'pass'
    | 'warn'
    | 'fail';
  message: string;
};

function envExists(
  name: string
) {
  return Boolean(
    process.env[name]?.trim()
  );
}

export function runSecurityAudit() {
  const checks: SecurityCheck[] =
    [];

  const database =
    envExists(
      'DATABASE_URL'
    );

  checks.push({
    name:
      'Database configuration',
    status: database
      ? 'pass'
      : 'fail',
    message: database
      ? 'DATABASE_URL is configured.'
      : 'DATABASE_URL is missing.'
  });

  const authSecret =
    envExists(
      'AUTH_SECRET'
    );

  checks.push({
    name:
      'Authentication secret',
    status: authSecret
      ? 'pass'
      : 'fail',
    message: authSecret
      ? 'AUTH_SECRET is configured.'
      : 'AUTH_SECRET is missing.'
  });

  const google =
    envExists(
      'GOOGLE_CLIENT_ID'
    ) &&
    envExists(
      'GOOGLE_CLIENT_SECRET'
    );

  checks.push({
    name:
      'Google OAuth',
    status: google
      ? 'pass'
      : 'warn',
    message: google
      ? 'Google OAuth is configured.'
      : 'Google OAuth is not configured.'
  });

  const blob =
    envExists(
      'BLOB_READ_WRITE_TOKEN'
    );

  checks.push({
    name:
      'Blob storage',
    status: blob
      ? 'pass'
      : 'warn',
    message: blob
      ? 'Blob storage is configured.'
      : 'Blob storage is not configured.'
  });

  const ai =
    envExists(
      'GEMINI_API_KEY'
    ) ||
    envExists(
      'GOOGLE_API_KEY'
    );

  checks.push({
    name:
      'AI provider',
    status: ai
      ? 'pass'
      : 'warn',
    message: ai
      ? 'AI provider credentials detected.'
      : 'AI provider credentials were not detected.'
  });

  const failure =
    checks.some(
      check =>
        check.status ===
        'fail'
    );

  const warning =
    checks.some(
      check =>
        check.status ===
        'warn'
    );

  return {
    status: failure
      ? 'critical'
      : warning
        ? 'warning'
        : 'healthy',

    checks,

    generatedAt:
      new Date().toISOString()
  };
}
