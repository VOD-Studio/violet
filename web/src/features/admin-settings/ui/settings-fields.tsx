import { Label, Switch, Field as UiField } from "@violet/ui";
import { type ReactNode, useId } from "react";

/**
 * Field - 设置页的「标签 + 控件」横排表单项
 *
 * 标签在左、控件在右；容器窄于 36rem（手机、分栏里的窄格）时由 @violet/ui 回到纵向。
 * `children` 必须是单个控件元素，由表单项自动接线 id 与 aria-*。
 */
export function Field({
	label,
	hint,
	children,
}: {
	label: ReactNode;
	hint?: ReactNode;
	children: ReactNode;
}) {
	return (
		<UiField label={label} hint={hint} orientation="horizontal">
			{children}
		</UiField>
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
	const id = useId();
	return (
		<div className="flex items-center justify-between gap-4">
			<Label htmlFor={id}>{label}</Label>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}
