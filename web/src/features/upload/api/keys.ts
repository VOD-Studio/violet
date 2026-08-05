/**
 * uploadKeys - 上传相关 query key 工厂
 *
 * 集中管理上传域 key，目前含秒传检查维度。
 */
export const uploadKeys = {
	/** 模块根 */
	all: ["upload"] as const,
	/** 秒传检查维度 */
	instant: () => [...uploadKeys.all, "instant"] as const,
	/** 具体秒传检查 */
	instantCheck: (hash: string) => [...uploadKeys.instant(), hash] as const,
};
