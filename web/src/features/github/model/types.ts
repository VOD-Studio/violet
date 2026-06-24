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

/**
 * Repo - GitHub 仓库数据
 *
 * 字段 snake_case 对齐后端 RepoData json tag。
 */
export interface Repo {
	/** 仓库名 */
	name: string;
	/** 仓库描述 */
	description: string;
	/** 仓库链接 */
	url: string;
	/** 主语言 */
	language: string;
	/** star 数 */
	stars: number;
	/** fork 数 */
	forks: number;
	/** 是否置顶 */
	pinned: boolean;
}
