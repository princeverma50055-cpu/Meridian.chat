export type SecurityCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
};

function envExists(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function runSecurityAudit(): {
  status: 'healthy' | 'warning' | 'critical';
  checks: SecurityCheck[];
  generatedAt: string;
} {
  const checks: SecurityCheck[] = [];

  checks.push({
    name: 'Database configuration',
    status: envExists('DATABASE_URL')
      ? 'pass'
      : 'fail',
    message: envExists('DATABASE_URL')
      ? 'DATABASE_URL is configured.'
      : 'DATABASE_URL is missing.'
  });

  checks.push({
    name: 'Authentication secret',
    status: envExists('AUTH_SECRET')
      ? 'pass'
      : 'fail',
    message: envExists('AUTH_SECRET')
      ? 'AUTH_SECRET is configured.'
      : 'AUTH_SECRET is missing.'
  });

  const googleConfigured =
    envExists('GOOGLE_CLIENT_ID') &&
    envExists('GOOGLE_CLIENT_SECRET');

  checks.push({
    name: 'Google OAuth',
    status: googleConfigured
      ? 'pass'
      : 'warn',
    message: googleConfigured
      ? 'Google OAuth credentials are configured.'
      : 'Google OAuth credentials are not configured.'
  });

  checks.push({
    name: 'Blob storage',
    status: envExists(
      'BLOB_READ_WRITE_TOKEN'
    )
      ? 'pass'
      : 'warn',
    message: envExists(
      'BLOB_READ_WRITE_TOKEN'
    )
      ? 'Blob storage token is configured.'
      : 'Blob storage token is not configured.'
  });

  checks.push({
    name: 'Gemini API',
    status:
      envExists('GEMINI_API_KEY') ||
      envExists('GOOGLE_API_KEY')
        ? 'pass'
        : 'warn',
    message:
      envExists('GEMINI_API_KEY') ||
      envExists('GOOGLE_API_KEY')
        ? 'AI provider credentials detected.'
        : 'AI provider credentials were not detected.'
  });

  const hasFailure = checks.some(
    check => check.status === 'fail'
  );

  const hasWarning = checks.some(
    check => check.status === 'warn'
  );

  return {
    status: hasFailure
      ? 'critical'
      : hasWarning
        ? 'warning'
        : 'healthy',
    checks,
    generatedAt: new Date().toISOString()
  };
}
