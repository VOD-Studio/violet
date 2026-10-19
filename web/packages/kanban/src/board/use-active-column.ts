import { useCallback, useState } from "react";
import { useLatest } from "./drag/use-latest.ts";

/** `useActiveColumn` 的输入。 */
export interface ActiveColumnOptions {
	columnIds: readonly string[];
	/** 受控的当前列 id；给出后以它为准。 */
	active?: string;
	/** 非受控时的初始列 id。 */
	defaultActive?: string;
	onChange?: (columnId: string) => void;
}

/**
 * 列切换布局显示哪一列：受控或非受控。值不是现有的列时落到第一列。
 *
 * `select` 读最新值判断是否真的变化，所以回滚等异步回调里拿着旧闭包调用也不会漏掉切换。
 */
export function useActiveColumn(options: ActiveColumnOptions) {
	const { columnIds, active, defaultActive } = options;
	const [internal, setInternal] = useState(defaultActive);
	const requested = active ?? internal;
	const current =
		requested !== undefined && columnIds.includes(requested) ? requested : columnIds[0];
	const live = useLatest({ options, current });

	const select = useCallback(
		(columnId: string) => {
			const { options: latest, current: shown } = live.current;
			if (columnId === shown || !latest.columnIds.includes(columnId)) return;
			if (latest.active === undefined) setInternal(columnId);
			latest.onChange?.(columnId);
		},
		[live],
	);
	return { current, select };
}
