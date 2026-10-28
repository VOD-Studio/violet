import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PresenceSettings } from "../model/types";
import {
	getPresenceDevices,
	getPresenceSettings,
	issuePresenceDevice,
	revokePresenceDevice,
	updatePresenceSettings,
} from "./client";
import { adminPresenceKeys } from "./keys";

/** 连接状态随设备上报变化，页面打开期间每 5 秒刷新。 */
const DEVICES_REFETCH_MS = 5000;

export const usePresenceDevices = () =>
	useQuery({
		queryKey: adminPresenceKeys.devices(),
		queryFn: getPresenceDevices,
		refetchInterval: DEVICES_REFETCH_MS,
	});

/**
 * 签发设备凭证。返回的 token 只在本次结果里出现，不写入缓存。
 */
export const useIssuePresenceDevice = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: issuePresenceDevice,
		onSuccess: () => qc.invalidateQueries({ queryKey: adminPresenceKeys.devices() }),
	});
};

export const useRevokePresenceDevice = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: revokePresenceDevice,
		onSuccess: () => qc.invalidateQueries({ queryKey: adminPresenceKeys.devices() }),
	});
};

export const usePresenceSettings = () =>
	useQuery({
		queryKey: adminPresenceKeys.settings(),
		queryFn: getPresenceSettings,
	});

export const useUpdatePresenceSettings = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (settings: PresenceSettings) => updatePresenceSettings(settings),
		onSuccess: (settings) => qc.setQueryData(adminPresenceKeys.settings(), settings),
	});
};
