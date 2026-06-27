import { Checkbox } from "@/shared/ui/checkbox";

interface RowCheckboxProps {
    /** 该行是否被选中 */
    selected: boolean;
    /** 切换该行选中态 */
    onToggle: () => void;
    /** 行号（从 1 开始的全局行号），用于无障碍 label */
    rowNumber: number;
}

/**
 * RowCheckbox - 行选择 checkbox
 */
export function RowCheckbox({ selected, onToggle, rowNumber }: RowCheckboxProps) {
    return (
        <div className="flex justify-center">
            <Checkbox
                checked={selected}
                onCheckedChange={onToggle}
                aria-label={`选择第 ${rowNumber} 行`}
            />
        </div>
    );
}
