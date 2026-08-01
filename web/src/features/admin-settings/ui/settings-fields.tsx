import { Switch } from "@shared/ui/base/switch";
import * as React from "react";

/**
 * Field - 设置表单的「标签 + 控件」包装
 *
 * 通过 cloneElement 给子控件注入 id，建立 label 关联。
 * 供各设置子页复用（提取自原 admin.settings.tsx 单页表单）。
 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    const id = React.useId();
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-medium">
                {label}
            </label>
            {React.Children.map(children, (child) =>
                React.isValidElement(child) ? (
                    React.cloneElement(child as React.ReactElement<{ id?: string }>, {
                        id,
                    })
                ) : (
                    child
                ),
            )}
        </div>
    );
}

/**
 * SwitchField - 设置表单的「标签 + 开关」行
 *
 * 标签在左、开关在右的行布局，供各设置子页复用。
 */
export function SwitchField({
    label,
    checked,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}
