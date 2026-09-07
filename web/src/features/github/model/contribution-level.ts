/**
 * 贡献热度分档：单日提交数到热力等级的映射。
 *
 * 大图与卡片热力图共用同一套档位，保证视觉口径一致。
 */
export function getContributionLevel(count: number): number {
	if (count === 0) return 0;
	if (count <= 2) return 1;
	if (count <= 5) return 2;
	if (count <= 9) return 3;
	return 4;
}

/** 热力等级到背景色阶的映射（浅灰 → 深黑渐进） */
export const CONTRIBUTION_LEVEL_CLASS: Record<number, string> = {
	0: "bg-muted",
	1: "bg-primary/30",
	2: "bg-primary/50",
	3: "bg-primary/75",
	4: "bg-primary",
};
