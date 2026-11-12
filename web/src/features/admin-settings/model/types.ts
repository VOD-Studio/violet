/** admin-settings 模块类型定义 */
import type { AboutConfig } from "@features/settings/model/types";

/** 基础信息组 */
export interface GeneralSettingsDTO {
	site_name: string;
	site_url: string;
	footer_text: string;
	posts_per_page: number;
	home_footprint_enabled: boolean;
	/** 节点聚合天数，范围 1–31 */
	home_footprint_aggregation_days: number;
	comments_enabled: boolean;
	comments_moderation: boolean;
	tech_stack: string;
	/** 单用户自定义表情份额上限（自传+收藏合计），0=未配置，前端显示时按 env 默认兜底 */
	custom_emoji_max_per_user: number;
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

/** 窗的城市（Open-Meteo 地理编码结果） */
export interface WindowCityDTO {
	name: string;
	/** 一级行政区，可为空串 */
	region: string;
	/** 国家，可为空串 */
	country: string;
	latitude: number;
	longitude: number;
	/** IANA 时区名 */
	timezone: string;
}

/** 窗外照片槽位：四种天气各一张，夜里另用一张 */
export type WindowPhotoSlot = "clear" | "cloudy" | "rain" | "snow" | "night";

/** 窗配置（全站背景：站长那边的天气与窗外的景） */
export interface WindowSettingsDTO {
	/** null 表示未配置城市，窗只画默认景、不显示天气 */
	city: WindowCityDTO | null;
	/** 五个槽位齐全；空串表示用内置的默认景 */
	photos: Record<WindowPhotoSlot, string>;
}
