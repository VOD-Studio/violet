import { Checkbox } from "@/shared/ui/checkbox";

interface SelectAllCheckboxProps {
	/** 当前页所有可见行是否全选 */
	allSelected: boolean;
	/** 当前页是否有部分行被选中 */
	someSelected: boolean;
	/** 全选/取消全选当前页 */
	onToggle: () => void;
}

/**
 * SelectAllCheckbox - 表头全选当前页 checkbox
 *
 * 三态：全选 / 部分选中（indeterminate）/ 无。
 * 仅作用于当前页可见行，跨页选中由调用方持有。
 */
export function SelectAllCheckbox({ allSelected, someSelected, onToggle }: SelectAllCheckboxProps) {
	return (
		<Checkbox
			checked={allSelected ? true : someSelected ? "indeterminate" : false}
			onCheckedChange={onToggle}
			aria-label="全选当前页"
		/>
	);
}
