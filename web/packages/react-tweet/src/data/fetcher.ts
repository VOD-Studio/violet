import type { TweetData } from "./types.js";

/**
 * 自定义加载器的取消选项。
 *
 * 忽略取消的旧请求结果仍会被组件丢弃。
 */
export interface TweetFetcherOptions {
	/**
	 * 请求取消信号。
	 *
	 * 卸载、重试或请求标识、加载器变化时触发。
	 */
	signal: AbortSignal;
}

/**
 * 可替换的异步内容获取边界。
 *
 * 不依赖特定站点、代理或状态管理库。
 *
 * @param id - 调用方提供的推文标识或原文地址。
 * @param options - 当前请求的取消信号。
 * @returns 可用快照或明确的不可用状态。
 */
export type TweetFetcher = (id: string, options: TweetFetcherOptions) => Promise<TweetData>;
