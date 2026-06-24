/**
 * 环境变量类型化访问
 *
 * 通过 interface declaration merging 给 Vite 内置 ImportMetaEnv 增加项目专用字段，
 * 让 import.meta.env.VITE_* 在 TS 中有类型与自动补全。
 *
 * 不需要 declare module —— Vite 8 已在 vite/types/importMeta.d.ts 声明 ImportMetaEnv，
 * 此处用同名 interface 自动 merge（推荐做法）。
 */

interface ImportMetaEnv {
	/** 客户端 API 基础路径（相对 /api/v1，由反向代理转发） */
	readonly VITE_API_BASE_URL: string;
	/** 前端对外地址（SEO、OpenGraph） */
	readonly VITE_SITE_URL: string;
	/** SSR 端内网回源地址（绕过反代直连后端容器） */
	readonly VITE_SSR_API_BASE_URL: string;
}

/**
 * AppEnv - 项目环境变量类型（导出供其它模块引用，触发 declaration merging 生效）
 */
export type AppEnv = ImportMetaEnv;

/**
 * SITE_URL - 前端对外地址（用于 SEO meta / OpenGraph / sitemap）
 *
 * 优先读 VITE_SITE_URL，缺失时回落到 localhost:5173（开发默认端口）。
 */
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? "http://localhost:5173";
