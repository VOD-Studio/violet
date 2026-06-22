/**
 * Contribution - 单日 GitHub 贡献
 */
export interface Contribution {
	/** 日期 YYYY-MM-DD */
	date: string;
	/** 当日提交数 */
	count: number;
	/** 强度等级 0-4（0=无提交，4=最活跃） */
	level: 0 | 1 | 2 | 3 | 4;
}

/**
 * ContributionSummary - 贡献图数据
 *
 * 对接后端 GET /api/v1/github/contributions。
 * 后端持有 GitHub token，前端无需传凭证。
 */
export interface ContributionSummary {
	/** 按日的贡献列表 */
	contributions: Contribution[];
	/** 总提交数 */
	total: number;
	/** 当前连续天数 */
	currentStreak: number;
}
