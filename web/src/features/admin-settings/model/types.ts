/**
 * admin-settings 模块类型定义
 *
 * 对齐后端 domain/settings.SiteSettings（GET /admin/settings 返回）。
 */

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
    /** 技术栈（单字符串） */
    tech_stack: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
    /** LLM API Key（OpenAI 协议兼容端点，敏感） */
    llm_api_key: string;
    /** LLM API Base URL（如 https://api.openai.com/v1） */
    llm_api_url: string;
    /** LLM 模型名（如 gpt-4o-mini） */
    llm_model: string;
    /** LLM 协议（目前仅 openai） */
    llm_protocol: string;
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
    /** 技术栈 */
    tech_stack: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
    /** LLM API Key */
    llm_api_key: string;
    /** LLM API Base URL */
    llm_api_url: string;
    /** LLM 模型名 */
    llm_model: string;
    /** LLM 协议 */
    llm_protocol: string;
}
