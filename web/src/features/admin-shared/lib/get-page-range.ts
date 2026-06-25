export type PageItem = number | "ellipsis";

/**
 * 计算分页页码序列，首页与末页常驻，当前页前后各 sibling 个，
 * 断档处用 ellipsis 占位
 */
export function getPageRange(current: number, totalPages: number, sibling = 1): PageItem[] {
	if (totalPages <= 0) return [];

	const clamped = Math.max(1, Math.min(current, totalPages));

	const threshold = 5 + sibling * 2;
	if (totalPages <= threshold) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const left = Math.max(2, clamped - sibling);
	const right = Math.min(totalPages - 1, clamped + sibling);

	const result: PageItem[] = [1];

	if (left > 2) {
		result.push("ellipsis");
	}

	for (let i = left; i <= right; i++) {
		result.push(i);
	}

	if (right < totalPages - 1) {
		result.push("ellipsis");
	}

	result.push(totalPages);

	return result;
}
