import { useState } from "react";

/** `useCollapsedColumns` 的输入。 */
export interface CollapsedColumnsOptions {
	/** 受控的折叠列 id；给出后以它为准。 */
	collapsed?: readonly string[];
	/** 非受控时的初始折叠列 id。 */
	defaultCollapsed?: readonly string[];
	onChange?: (collapsed: string[]) => void;
}

/** 折叠状态：受控或非受控，变化时报告完整的折叠列表。 */
export function useCollapsedColumns(options: CollapsedColumnsOptions) {
	const { collapsed, defaultCollapsed, onChange } = options;
	const [internal, setInternal] = useState<readonly string[]>(defaultCollapsed ?? []);
	const current = collapsed ?? internal;

	const update = (next: string[]) => {
		if (collapsed === undefined) setInternal(next);
		onChange?.(next);
	};
	const isCollapsed = (id: string) => current.includes(id);
	const toggle = (id: string) =>
		update(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
	/** 展开一列；本来就展开时什么也不做。 */
	const expand = (id: string) => {
		if (current.includes(id)) update(current.filter((item) => item !== id));
	};
	return { isCollapsed, toggle, expand };
}
