/**
 * admin-settings 模块类型定义
 *
 * 站点设置已按菜单子页拆成 7 组，对齐后端分组接口：
 *   GET/PUT /admin/settings/{general|auth|github|profile|about|llm|code-runner}
 * 每组独立 DTO，前端各子页独立 queryKey 互不干扰，消除全量聚合带来的回填竞态。
 */
import type { AboutConfig } from "@features/settings/model/types";

/** 基础信息组 */
export interface GeneralSettingsDTO {
    site_name: string;
    site_description: string;
    site_url: string;
    admin_email: string;
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

/** GitHub 组（用户名/Token/更新日志仓库名） */
export interface GithubSettingsDTO {
    github_username: string;
    github_token: string;
    releases_repo: string;
}

/** 关于博主组（头像/标语/名片/技能/社交矩阵/简介/页脚） */
export interface ProfileSettingsDTO {
    bio: string;
    footer_text: string;
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
