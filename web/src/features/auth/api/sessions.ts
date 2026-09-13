import type {
	IssueOpsGrantRequest,
	OpsGrantResponse,
	SessionDevice,
} from "@features/auth/model/types";
import { apiDelete, apiGet, apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authKeys } from "./keys";

/** 会话设备列表与短时运维授权的查询/变更 hooks（绑定当前登录会话）。 */

function useSessionsQueryKey() {
	const version = useSessionStore((s) => s.sessionVersion);
	return { key: authKeys.sessions(version), version };
}

/**
 * 当前用户登录会话（设备列表）。登录即可查自己的会话，无需后台权限；
 * queryKey 携带 sessionVersion，登录身份切换后不复用前一用户的缓存。
 */
export const useSessions = () => {
	const { key } = useSessionsQueryKey();
	return useQuery({
		queryKey: key,
		queryFn: () => apiGet<SessionDevice[]>("/auth/sessions"),
	});
};

/** 吊销当前用户的指定会话：吊销当前会话等同该设备登出，其他会话请求立即 401。 */
export const useRevokeSession = () => {
	const qc = useQueryClient();
	const { version } = useSessionsQueryKey();
	return useMutation({
		mutationFn: (publicID: string) => apiDelete<null>(`/auth/sessions/${publicID}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.sessions(version) });
			toast.success("会话已吊销");
		},
		onError: (e: Error) => toast.error(`吊销失败：${e.message}`),
	});
};

/** 发送运维授权邮箱验证码（OAuth 无密码用户的二次验证通道）。 */
export const useRequestOpsGrantCode = () =>
	useMutation({
		mutationFn: () => apiPost<null>("/auth/ops-grant/code", {}),
		onSuccess: () => toast.success("验证码已发送到账号绑定邮箱"),
		onError: (e: Error) => toast.error(`发送失败：${e.message}`),
	});

/** 通过当前密码或邮箱验证码换取绑定当前会话的短时运维授权（默认 10 分钟）。 */
export const useIssueOpsGrant = () =>
	useMutation({
		mutationFn: (body: IssueOpsGrantRequest) =>
			apiPost<OpsGrantResponse>("/auth/ops-grant", body, { __skipAuthDialog: true }),
		onError: (e: Error) => toast.error(e.message),
	});

/** 主动吊销当前会话的全部运维授权（完成后收权）。 */
export const useRevokeOpsGrant = () =>
	useMutation({
		mutationFn: () => apiDelete<null>("/auth/ops-grant"),
		onSuccess: () => toast.success("运维授权已吊销"),
		onError: (e: Error) => toast.error(`吊销失败：${e.message}`),
	});
