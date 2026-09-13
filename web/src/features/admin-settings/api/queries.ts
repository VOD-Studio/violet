import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { notifySettingsChanged } from "@features/settings/api/cache-events";
import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OAuthCredentialsInput, SettingsSnapshot } from "../model/types";
import * as api from "./client";
import { settingsKeys } from "./keys";

function useSettingsQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>) {
	const canView = useHasPermission("settings:view");
	return useQuery({ queryKey, queryFn, enabled: canView });
}

function useSettingsUpdate<T, TInput>(
	queryKey: QueryKey,
	mutationFn: (input: TInput) => Promise<SettingsSnapshot<T>>,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn,
		onSuccess: (data) => {
			qc.setQueryData(queryKey, data);
			notifySettingsChanged(qc);
			if (data.meta.status === "failed") {
				toast.error("设置已保存，但应用失败；当前仍使用原有效版本");
			} else if (data.meta.status === "pending_restart") {
				toast.success("设置已保存，重启后生效");
			} else {
				toast.success("设置已保存并应用");
			}
		},
	});
}

export const useGeneralSettings = () => useSettingsQuery(settingsKeys.general(), api.getGeneral);
export const useUpdateGeneral = () => useSettingsUpdate(settingsKeys.general(), api.updateGeneral);
export const useAuthSettings = () => useSettingsQuery(settingsKeys.auth(), api.getAuth);
export const useUpdateAuth = () => useSettingsUpdate(settingsKeys.auth(), api.updateAuth);
export const useSecuritySettings = () => useSettingsQuery(settingsKeys.security(), api.getSecurity);
export const useRequestSecurityChange = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: api.requestSecurityChange,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: settingsKeys.security() });
			toast.success("变更已暂存，请在 10 分钟内完成二次验证并确认生效");
		},
		onError: (e: Error) => toast.error(`暂存失败：${e.message}`),
	});
};
export const useConfirmSecurityChange = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (pendingId: string) => api.confirmSecurityChange(pendingId),
		onSuccess: (data) => {
			qc.setQueryData(settingsKeys.security(), data);
			notifySettingsChanged(qc);
			toast.success("安全策略已确认并生效");
		},
		onError: (e: Error) => toast.error(`确认失败：${e.message}`),
	});
};
export const useCancelSecurityChange = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: api.cancelSecurityChange,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: settingsKeys.security() });
			toast.success("已取消待确认的安全策略变更");
		},
	});
};
export const useGithubSettings = () => useSettingsQuery(settingsKeys.github(), api.getGithub);
export const useUpdateGithub = () => useSettingsUpdate(settingsKeys.github(), api.updateGithub);
export const useProfileSettings = () => useSettingsQuery(settingsKeys.profile(), api.getProfile);
export const useUpdateProfile = () => useSettingsUpdate(settingsKeys.profile(), api.updateProfile);
export const useAboutSettings = () => useSettingsQuery(settingsKeys.about(), api.getAbout);
export const useUpdateAbout = () => useSettingsUpdate(settingsKeys.about(), api.updateAbout);
export const useLlmSettings = () => useSettingsQuery(settingsKeys.llm(), api.getLlm);
export const useUpdateLlm = () => useSettingsUpdate(settingsKeys.llm(), api.updateLlm);
export const useCodeRunnerSettings = () =>
	useSettingsQuery(settingsKeys.codeRunner(), api.getCodeRunner);
export const useUpdateCodeRunner = () =>
	useSettingsUpdate(settingsKeys.codeRunner(), api.updateCodeRunner);
export const useStartupSettings = () => useSettingsQuery(settingsKeys.startup(), api.getStartup);

// ---- OAuth 凭据（env 域，独立端点） ----
export const useOAuthStatus = () => useSettingsQuery(settingsKeys.oauth(), api.getOAuthStatus);
export const useUpdateOAuthCredentials = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: OAuthCredentialsInput) => api.updateOAuthCredentials(body),
		onSuccess: (data) => {
			// 覆盖 status 缓存的 provider 部分（enabled 开关字段保持）
			qc.setQueryData<
				Partial<{
					google: typeof data.google;
					github: typeof data.github;
					persisted: boolean;
				}>
			>(settingsKeys.oauth(), (prev) => ({ ...(prev ?? {}), ...data }));
			notifySettingsChanged(qc);
			toast.success(
				data.persisted ? "OAuth 凭据已保存" : "OAuth 凭据已保存（未落盘，重启后失效）",
			);
		},
		onError: (e: Error) => toast.error(`保存失败：${e.message}`),
	});
};

export const useVerifyOAuth = () => {
	return useMutation({
		mutationFn: (provider: string) => api.verifyOAuthCredentials(provider),
		onError: (e: Error) => toast.error(`检测失败：${e.message}`),
	});
};
