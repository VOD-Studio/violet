/** admin-settings 模块类型定义 */
import type { AboutConfig } from "@features/settings/model/types";

/** 基础信息组 */
export interface GeneralSettingsDTO {
	site_name: string;
	site_url: string;
	footer_text: string;
	footer_github_url: string;
	posts_per_page: number;
	home_footprint_enabled: boolean;
	/** 节点聚合天数，范围 1–31 */
	home_footprint_aggregation_days: number;
	comments_enabled: boolean;
	comments_moderation: boolean;
	tech_stack: string;
	/** 单用户自定义表情份额上限（自传与收藏合计）。 */
	custom_emoji_max_per_user: number;
}

/** 认证组（第三方登录开关） */
export interface AuthSettingsDTO {
	google_login_enabled: boolean;
	github_login_enabled: boolean;
}

/** 安全策略组（可信来源/可信代理/Cookie 约束/并发会话上限；变更需限时确认） */
export interface SecuritySettingsDTO {
	/** 可信来源列表（逗号/换行分隔 HTTPS origin）；空串沿用部署默认 */
	trusted_origins: string;
	/** 可信代理 CIDR/IP 列表；空串沿用部署默认 */
	trusted_proxies: string;
	/** Cookie 是否强制 Secure（部署底线强制时只读 true） */
	cookie_secure: boolean;
	/** Cookie SameSite 策略：lax | strict | none */
	cookie_same_site: string;
	/** 并发登录会话上限；0 不限制 */
	session_max_devices: number;
}

/** 待确认的安全策略变更 */
export interface SecurityPendingDTO {
	/** 待确认变更标识；确认时回传，被替换的旧标识确认会被拒绝 */
	id: string;
	/** 发起时的组版本 */
	expected_version: number;
	/** 待生效的覆盖值 */
	values: Record<string, unknown>;
	/** 发起者用户 ID */
	requested_by: string;
	/** 发起时间（RFC3339） */
	requested_at: string;
	/** 确认截止时间（RFC3339） */
	expires_at: string;
}

/** 安全组响应：组视图 + 可选 pending */
export interface SecuritySnapshot extends SettingsSnapshot<SecuritySettingsDTO> {
	pending?: SecurityPendingDTO;
}

/** 单个 OAuth provider 的凭据状态（/admin/oauth/status） */
export interface OAuthProviderStatus {
	/** 凭据齐全，登录链路可用 */
	configured: boolean;
	/** client_id 脱敏预览（secret 永不下发） */
	client_id_preview: string;
	/** 不可用原因（空串=正常） */
	issue: string;
}

/** OAuth 凭据状态（/admin/oauth/status 响应） */
export interface OAuthStatusDTO {
	google_login_enabled: boolean;
	github_login_enabled: boolean;
	google: OAuthProviderStatus;
	github: OAuthProviderStatus;
	/** 最近一次写入是否成功落盘 .env（false=重启后失效） */
	persisted: boolean;
}

/** OAuth 凭据写入入参（全可选；留空字段=保持原值，secret 不回显） */
export interface OAuthCredentialsInput {
	google_client_id?: string;
	github_client_id?: string;
	github_client_secret?: string;
}

/** GitHub 组（用户名/Token/更新日志仓库名） */
export interface GithubSettingsDTO {
	github_username: string;
	github_token_set: boolean;
	releases_repo: string;
}

/** 关于博主组（头像/标语/名片/技能/社交矩阵/简介） */
export interface ProfileSettingsDTO {
	bio: string;
	avatar_url: string;
	tagline: string;
	profile_role: string;
	profile_location: string;
	available_for: string;
	skills_strong: string;
	skills_learning: string;
	skills_interests: string;
	social_twitter: string;
	social_mastodon: string;
	social_email: string;
	social_rss: string;
	social_bilibili: string;
}

/** 关于页区块配置组（about_config 原生 JSON 对象） */
export interface AboutSettingsDTO {
	about_config: AboutConfig | null;
}

/** 未配置的读取值可为 null；写入清空区块使用空 sections，恢复默认使用 reset。 */
export interface AboutSettingsWrite {
	about_config: AboutConfig;
}

/** LLM 组（OpenAI 协议兼容端点） */
export interface LlmSettingsDTO {
	llm_api_key_set: boolean;
	llm_api_url: string;
	llm_model: string;
	llm_protocol: string;
}

/** 代码运行器组 */
export interface CodeRunnerSettingsDTO {
	code_runner_enabled: boolean;
	code_runner_max_cpu_cores: number;
	code_runner_max_memory_mb: number;
	code_runner_max_timeout_secs: number;
	code_runner_max_output_bytes: number;
	code_runner_max_source_bytes: number;
	code_runner_allow_network: boolean;
	code_runner_languages: string;
}

/** 写入秘密时：省略保留，空字符串明确清除。 */
export interface GithubSettingsWrite extends Omit<GithubSettingsDTO, "github_token_set"> {
	github_token: string;
}

/** 写入秘密时：省略保留，空字符串明确清除。 */
export interface LlmSettingsWrite extends Omit<LlmSettingsDTO, "llm_api_key_set"> {
	llm_api_key: string;
}

export interface SettingsMeta {
	saved_version: number;
	applied_version: number;
	effect: "new_request" | "new_task" | "restart";
	status: "applied" | "pending_restart" | "failed";
	sources: Record<string, "database" | "deployment_default">;
	error?: string;
}

/** 管理端返回保存快照与实际应用状态，公开端仍返回扁平设置。 */
export interface SettingsSnapshot<T> {
	values: T;
	meta: SettingsMeta;
}

/** expected_version 始终来自开始编辑时的保存快照。 */
export interface SettingsUpdate<T> {
	expected_version: number;
	values: Partial<T>;
}

export type SettingsGroup =
	| "general"
	| "auth"
	| "security"
	| "github"
	| "profile"
	| "about"
	| "llm"
	| "code-runner";

export interface StartupSnapshot {
	observed_at: string;
	sections: {
		id: string;
		label: string;
		fields: {
			key: string;
			label: string;
			value: string | number | boolean | null;
			source: "environment" | "default" | "runtime";
			sensitive: boolean;
		}[];
	}[];
}
