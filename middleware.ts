function isSensitiveApi(pathname: string) {
  return (
    pathname.startsWith('/api/chat') ||
    pathname.startsWith('/api/files/upload') ||
    pathname.startsWith('/api/account/') ||
    pathname.startsWith('/api/auth/')
  );
}
