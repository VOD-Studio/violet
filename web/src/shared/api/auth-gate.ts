import type { AxiosRequestConfig } from "axios";

export const setReplayer = (_fn: ((config: AxiosRequestConfig) => Promise<any>) | null) => {};
export const requestReplay = (_config: AxiosRequestConfig) => Promise.reject(new Error("Stub"));
export const notifySessionExpired = () => {};
export const setOpener = (_fn: (() => void) | null) => {};
export const flush = () => Promise.resolve();
export const rejectAll = () => {};
