import { apiGet } from "@/shared/api/request";
import type { Presence } from "../model/types";

export const PRESENCE_STREAM_URL = "/api/v1/presence/stream";

export const getPresence = async (): Promise<Presence> => apiGet<Presence>("/presence");
