/** admin-settings 模块类型定义 */
import type { AboutConfig } from "@features/settings/model/types";

/** SiteSettingsDTO - 站点配置读模型 */
export interface SiteSettingsDTO {
    /** 站点名称 */
    site_name: string;
    /** 站点描述 */
    site_description: string;
    /** 站点 URL */
    site_url: string;
    /** 管理员邮箱 */
    admin_email: string;
    /** 每页文章数 */
    posts_per_page: number;
    /** 是否启用评论 */
    comments_enabled: boolean;
    /** 评论是否需审核 */
    comments_moderation: boolean;
    /** 是否启用 Google 登录 */
    google_login_enabled: boolean;
    /** 是否启用 GitHub 登录 */
    github_login_enabled: boolean;
    /** GitHub 用户名 */
    github_username: string;
    /** GitHub Token */
    github_token: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
    /** 关于页区块版面配置（原生 JSON 对象；null 表示未配置） */
    about_config: AboutConfig | null;
    /** 关于博主（A 线）内容字段 */
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
    /** 更新日志区块读取的 GitHub 仓库名 */
    releases_repo: string;
    /** LLM API Key（OpenAI 协议兼容端点，敏感） */
    llm_api_key: string;
    /** LLM API Base URL（如 https://api.openai.com/v1） */
    llm_api_url: string;
    /** LLM 模型名（如 gpt-4o-mini） */
    llm_model: string;
    /** LLM 协议（目前仅 openai） */
    llm_protocol: string;
    /** 代码运行器：是否启用 */
    code_runner_enabled: boolean;
    /** 代码运行器：CPU 上限（核数） */
    code_runner_max_cpu_cores: number;
    /** 代码运行器：内存上限（MB） */
    code_runner_max_memory_mb: number;
    /** 代码运行器：超时上限（秒） */
    code_runner_max_timeout_secs: number;
    /** 代码运行器：输出上限（字节） */
    code_runner_max_output_bytes: number;
    /** 代码运行器：源码上限（字节） */
    code_runner_max_source_bytes: number;
    /** 代码运行器：是否允许网络 */
    code_runner_allow_network: boolean;
    /** 代码运行器：语言白名单（逗号分隔，空=全部） */
    code_runner_languages: string;
}

/** UpdateSettingsRequest - 更新站点配置请求体（全字段） */
export interface UpdateSettingsRequest {
    /** 站点名称 */
    site_name: string;
    /** 站点描述 */
    site_description: string;
    /** 站点 URL */
    site_url: string;
    /** 管理员邮箱 */
    admin_email: string;
    /** 每页文章数 */
    posts_per_page: number;
    /** 是否启用评论 */
    comments_enabled: boolean;
    /** 评论是否需审核 */
    comments_moderation: boolean;
    /** 是否启用 Google 登录 */
    google_login_enabled: boolean;
    /** 是否启用 GitHub 登录 */
    github_login_enabled: boolean;
    /** GitHub 用户名 */
    github_username: string;
    /** GitHub Token */
    github_token: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
    /** 关于页区块版面配置（原生 JSON 对象；null 表示未配置） */
    about_config: AboutConfig | null;
    /** 关于博主（A 线）内容字段 */
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
    /** 更新日志区块读取的 GitHub 仓库名 */
    releases_repo: string;
    /** LLM API Key */
    llm_api_key: string;
    /** LLM API Base URL */
    llm_api_url: string;
    /** LLM 模型名 */
    llm_model: string;
    /** LLM 协议 */
    llm_protocol: string;
    /** 代码运行器：是否启用 */
    code_runner_enabled: boolean;
    /** 代码运行器：CPU 上限（核数） */
    code_runner_max_cpu_cores: number;
    /** 代码运行器：内存上限（MB） */
    code_runner_max_memory_mb: number;
    /** 代码运行器：超时上限（秒） */
    code_runner_max_timeout_secs: number;
    /** 代码运行器：输出上限（字节） */
    code_runner_max_output_bytes: number;
    /** 代码运行器：源码上限（字节） */
    code_runner_max_source_bytes: number;
    /** 代码运行器：是否允许网络 */
    code_runner_allow_network: boolean;
    /** 代码运行器：语言白名单（逗号分隔，空=全部） */
    code_runner_languages: string;
}
