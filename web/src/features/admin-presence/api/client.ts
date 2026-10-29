import { apiDelete, apiGet, apiPost, apiPut } from "@/shared/api/request";
import type { AdminPresenceDevice, IssuedPresenceDevice, PresenceSettings } from "../model/types";

const BASE = "/admin/presence";

export const getPresenceDevices = async (): Promise<AdminPresenceDevice[]> =>
	apiGet<AdminPresenceDevice[]>(`${BASE}/devices`);

export const issuePresenceDevice = async (displayName: string): Promise<IssuedPresenceDevice> =>
	apiPost<IssuedPresenceDevice>(`${BASE}/devices`, { display_name: displayName });

export const revokePresenceDevice = async (id: string): Promise<void> =>
	apiDelete<void>(`${BASE}/devices/${encodeURIComponent(id)}`);

export const getPresenceSettings = async (): Promise<PresenceSettings> =>
	apiGet<PresenceSettings>(`${BASE}/settings`);

export const updatePresenceSettings = async (
	settings: PresenceSettings,
): Promise<PresenceSettings> => apiPut<PresenceSettings>(`${BASE}/settings`, settings);
