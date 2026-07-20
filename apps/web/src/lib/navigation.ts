const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

export function safeInternalPath(value: unknown, fallback = '/'): string {
    if (
        typeof value !== 'string'
        || value.length === 0
        || value.length > 2048
        || !value.startsWith('/')
        || value.startsWith('//')
        || value.includes('\\')
        || value.includes('#')
        || CONTROL_CHARACTER.test(value)
    ) {
        return fallback;
    }

    try {
        const baseUrl = 'https://anlok.invalid';
        const parsed = new URL(value, baseUrl);
        if (parsed.origin !== baseUrl || !parsed.pathname.startsWith('/')) {
            return fallback;
        }
    } catch {
        return fallback;
    }

    return value;
}
