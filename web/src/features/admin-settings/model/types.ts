/** admin-settings 模块类型定义 */
import type { AboutConfig } from "@features/settings/model/types";

/** 基础信息组 */
export interface GeneralSettingsDTO {
	site_name: string;
	site_url: string;
	footer_text: string;
	posts_per_page: number;
	comments_enabled: boolean;
	comments_moderation: boolean;
	tech_stack: string;
}

/** 认证组（第三方登录开关） */
export interface AuthSettingsDTO {
	google_login_enabled: boolean;
	github_login_enabled: boolean;
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
	github_token: string;
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

/** LLM 组（OpenAI 协议兼容端点） */
export interface LlmSettingsDTO {
	llm_api_key: string;
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
