import type { RateLimitPolicy, RateLimitRule } from "@entities/runtime-policy/model/types";

/** 只发送变化的字段，显式 false、0 和空数组均保留。 */
export function changedPolicyFields<T extends object>(baseline: T, draft: T): Partial<T> {
	const changes: Partial<T> = {};
	for (const key of Object.keys(draft) as (keyof T)[]) {
		if (JSON.stringify(baseline[key]) !== JSON.stringify(draft[key])) changes[key] = draft[key];
	}
	return changes;
}

/** 限流保留规则与字段两级省略语义。 */
export function changedRateLimitFields(baseline: RateLimitPolicy, draft: RateLimitPolicy) {
	const rules: Record<string, Partial<RateLimitRule>> = {};
	for (const [id, rule] of Object.entries(draft.rules)) {
		const current = baseline.rules[id];
		const changes = current ? changedPolicyFields(current, rule) : rule;
		if (Object.keys(changes).length) rules[id] = changes;
	}
	return { rules };
}
