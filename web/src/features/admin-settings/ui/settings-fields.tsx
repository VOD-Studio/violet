import { Switch } from "@shared/ui/base/switch";
import * as React from "react";
import type { SettingsMeta } from "../model/types";

/** 将字段错误与保存来源传递给设置表单控件。 */
export const SettingsFieldContext = React.createContext<{
	errors: Record<string, unknown>;
	sources: SettingsMeta["sources"];
}>({ errors: {}, sources: {} });

interface FieldProps {
	label: string;
	children: React.ReactNode;
}

/** 只给表单控件注入标签关联、错误与来源说明，不改写辅助文案的 id。 */
export function Field({ label, children }: FieldProps) {
	const id = React.useId();
	const { errors, sources } = React.useContext(SettingsFieldContext);
	const elements = React.Children.toArray(children);
	const control = elements.find(
		(child) => React.isValidElement<{ name?: string }>(child) && child.props.name,
	);
	const name = React.isValidElement<{ name?: string }>(control) ? control.props.name : undefined;
	const error = name ? errors[name] : undefined;
	const message =
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
			? error.message
			: undefined;
	const source = name ? sources[name] : undefined;
	return (
		<div className="flex min-w-0 flex-col gap-1.5" data-invalid={!!message}>
			<label htmlFor={id} className="text-sm font-medium">
				{label}
			</label>
			{elements.map((child, index) => {
				if (
					!React.isValidElement<{
						name?: string;
						id?: string;
						"aria-invalid"?: boolean;
						"aria-describedby"?: string;
					}>(child)
				)
					return child;
				if (child !== control && (control || index !== 0)) return child;
				return React.cloneElement(child, {
					id,
					"aria-invalid": !!message,
					"aria-describedby": `${id}-details`,
				});
			})}
			<div id={`${id}-details`} className="flex flex-col gap-1 text-xs">
				{source && (
					<span className="text-muted-foreground">
						{source === "database" ? "来源：数据库覆盖" : "来源：部署默认"}
					</span>
				)}
				{message && (
					<span role="alert" className="text-destructive">
						{message}
					</span>
				)}
			</div>
		</div>
	);
}

interface SwitchFieldProps {
	label: string;
	checked: boolean;
	onCheckedChange: (value: boolean) => void;
	name?: string;
}

/** 标签关联的设置开关。 */
export function SwitchField({ label, checked, onCheckedChange, name }: SwitchFieldProps) {
	const id = React.useId();
	return (
		<div className="flex items-center justify-between gap-4">
			<label htmlFor={id} className="text-sm font-medium">
				{label}
			</label>
			<Switch id={id} name={name} checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}
