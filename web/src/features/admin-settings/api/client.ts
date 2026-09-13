import { apiDelete, apiGet, apiPost, apiPut } from "@shared/api/request";
import type {
	AboutSettingsDTO,
	AboutSettingsWrite,
	AuthSettingsDTO,
	CodeRunnerSettingsDTO,
	GeneralSettingsDTO,
	GithubSettingsDTO,
	GithubSettingsWrite,
	LlmSettingsDTO,
	LlmSettingsWrite,
	OAuthCredentialsInput,
	OAuthProviderStatus,
	ProfileSettingsDTO,
	SecurityPendingDTO,
	SecuritySettingsDTO,
	SecuritySnapshot,
	SettingsGroup,
	SettingsSnapshot,
	SettingsUpdate,
	StartupSnapshot,
} from "../model/types";

const BASE = "/admin/settings";
const OAUTH_BASE = "/admin/oauth";

export const getGeneral = () => apiGet<SettingsSnapshot<GeneralSettingsDTO>>(`${BASE}/general`);
export const updateGeneral = (body: SettingsUpdate<GeneralSettingsDTO>) =>
	apiPut<SettingsSnapshot<GeneralSettingsDTO>>(`${BASE}/general`, body);

export const getAuth = () => apiGet<SettingsSnapshot<AuthSettingsDTO>>(`${BASE}/auth`);
export const updateAuth = (body: SettingsUpdate<AuthSettingsDTO>) =>
	apiPut<SettingsSnapshot<AuthSettingsDTO>>(`${BASE}/auth`, body);

/** 安全组走两阶段：PUT 暂存待确认，confirm 需短时运维授权 */
export const getSecurity = () => apiGet<SecuritySnapshot>(`${BASE}/security`);
export const requestSecurityChange = (body: SettingsUpdate<SecuritySettingsDTO>) =>
	apiPut<{ pending: SecurityPendingDTO }>(`${BASE}/security`, body);
export const confirmSecurityChange = (pendingId: string) =>
	apiPost<SettingsSnapshot<SecuritySettingsDTO>>(`${BASE}/security/confirm`, {
		pending_id: pendingId,
	});
export const cancelSecurityChange = () => apiDelete<null>(`${BASE}/security/pending`);

export const getGithub = () => apiGet<SettingsSnapshot<GithubSettingsDTO>>(`${BASE}/github`);
export const updateGithub = (body: SettingsUpdate<GithubSettingsWrite>) =>
	apiPut<SettingsSnapshot<GithubSettingsDTO>>(`${BASE}/github`, body);

export const getProfile = () => apiGet<SettingsSnapshot<ProfileSettingsDTO>>(`${BASE}/profile`);
export const updateProfile = (body: SettingsUpdate<ProfileSettingsDTO>) =>
	apiPut<SettingsSnapshot<ProfileSettingsDTO>>(`${BASE}/profile`, body);

export const getAbout = () => apiGet<SettingsSnapshot<AboutSettingsDTO>>(`${BASE}/about`);
export const updateAbout = (body: SettingsUpdate<AboutSettingsWrite>) =>
	apiPut<SettingsSnapshot<AboutSettingsDTO>>(`${BASE}/about`, body);

export const getLlm = () => apiGet<SettingsSnapshot<LlmSettingsDTO>>(`${BASE}/llm`);
export const updateLlm = (body: SettingsUpdate<LlmSettingsWrite>) =>
	apiPut<SettingsSnapshot<LlmSettingsDTO>>(`${BASE}/llm`, body);

export const getCodeRunner = () =>
	apiGet<SettingsSnapshot<CodeRunnerSettingsDTO>>(`${BASE}/code-runner`);
export const updateCodeRunner = (body: SettingsUpdate<CodeRunnerSettingsDTO>) =>
	apiPut<SettingsSnapshot<CodeRunnerSettingsDTO>>(`${BASE}/code-runner`, body);

export const resetSettings = <T>(group: SettingsGroup, expected_version: number) =>
	apiPost<SettingsSnapshot<T>>(`${BASE}/${group}/reset`, { expected_version });

export const getStartup = () => apiGet<StartupSnapshot>(`${BASE}/startup`);

/** OAuth 凭据状态与写入（env 域，独立于 settings 分组，不落库） */
export const getOAuthStatus = () =>
	apiGet<{
		google_login_enabled: boolean;
		github_login_enabled: boolean;
		google: OAuthProviderStatus;
		github: OAuthProviderStatus;
		persisted: boolean;
	}>(`${OAUTH_BASE}/status`);
export const updateOAuthCredentials = (body: OAuthCredentialsInput) =>
	apiPut<{
		google: OAuthProviderStatus;
		github: OAuthProviderStatus;
		persisted: boolean;
	}>(`${OAUTH_BASE}/credentials`, body);
/** 探测 provider 侧凭据有效性（假 code 打 token 端点读错误码） */
export const verifyOAuthCredentials = (provider: string) =>
	apiPost<{ valid: boolean; detail: string }>(`${OAUTH_BASE}/verify`, { provider });
