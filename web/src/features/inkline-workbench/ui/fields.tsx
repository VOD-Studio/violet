import { cn } from "cn";
import { type ReactNode, useId } from "react";

/** 右侧面板的一行参数：上方标签与读数，下方控件。 */
export function Field({
	label,
	value,
	children,
}: {
	label: string;
	/** 标签右侧的当前读数 */
	value?: ReactNode;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<div className="grid gap-1.5">
			<div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
				<label htmlFor={id}>{label}</label>
				{value !== undefined && (
					<span className="font-mono tabular-nums text-foreground">{value}</span>
				)}
			</div>
			{children(id)}
		</div>
	);
}

export interface SelectOption<V extends string | number> {
	value: V;
	label: string;
}

/** 原生下拉框；选项值可以是数字，回调拿到的是原类型。 */
export function NativeSelect<V extends string | number>({
	id,
	value,
	options,
	onChange,
	className,
}: {
	id?: string;
	value: V;
	options: readonly SelectOption<V>[];
	onChange: (value: V) => void;
	className?: string;
}) {
	return (
		<select
			id={id}
			value={String(value)}
			onChange={(event) => {
				const option = options.find((o) => String(o.value) === event.target.value);
				if (option) onChange(option.value);
			}}
			className={cn(
				"h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
				className,
			)}
		>
			{options.map((option) => (
				<option key={String(option.value)} value={String(option.value)}>
					{option.label}
				</option>
			))}
		</select>
	);
}
