const PUBLIC_AUTH_ROUTES = new Set(['/login', '/oauth/authorize']);

export function isPublicAuthRoute(pathname: string): boolean {
    return PUBLIC_AUTH_ROUTES.has(pathname);
}

export function authenticationRedirect(pathname: string): string | null {
    return isPublicAuthRoute(pathname) ? null : '/login';
}
