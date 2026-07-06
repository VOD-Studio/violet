export const scheduleRefresh = (_expires: number) => {};
export const clearRefresh = () => {};
export const setRefresher = (_fn: (() => Promise<number | null>) | null) => {};
export const setOnSessionExpired = (_fn: (() => void) | null) => {};
