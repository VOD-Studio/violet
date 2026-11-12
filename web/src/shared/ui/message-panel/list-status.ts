/** 列表数据的三种状态；空是 `ready` 且没有条目。 */
export type ListStatus = "loading" | "error" | "ready";

/** 查询状态 → 列表状态：有数据即 ready（含刷新失败时的旧数据），否则看是否出错。 */
export function listStatus(hasData: boolean, isError: boolean): ListStatus {
	if (hasData) return "ready";
	return isError ? "error" : "loading";
}
