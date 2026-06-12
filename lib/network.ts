const DEFAULT_NETWORK_TIMEOUT_MS = 15000;

export const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs = DEFAULT_NETWORK_TIMEOUT_MS,
    timeoutMessage = 'Request timed out'
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};

export const fetchWithTimeout = async (
    url: string,
    options: RequestInit = {},
    timeoutMs = DEFAULT_NETWORK_TIMEOUT_MS
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const invokeSupabaseFunctionWithTimeout = async <T>(
    invokeFn: () => Promise<T>,
    timeoutMs = DEFAULT_NETWORK_TIMEOUT_MS
): Promise<T> => {
    return withTimeout(invokeFn(), timeoutMs, 'Supabase function request timed out');
};
