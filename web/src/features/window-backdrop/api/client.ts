import { apiGet, apiPost } from "@shared/api/request";
import type { WindowState } from "../model/types";

export const getWindow = () => apiGet<WindowState>("/window");

export const knockWindow = (page: string) => apiPost<null>("/window/knock", { page });
