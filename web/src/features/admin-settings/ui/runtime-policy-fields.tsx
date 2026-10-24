import {
	Button,
	Input,
	Label,
	Switch,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@violet/ui";
import { CircleHelp } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useState } from "react";

/** 字段展示上下文不决定表单结构或字段类型。 */
export interface RuntimeFieldState {
	disabled: boolean;
	sources: Record<string, string>;
	saved: Record<string, unknown>;
	effective: Record<string, unknown>;
	error: (name: string) => string | undefined;
}
export const RuntimeFieldContext = createContext<RuntimeFieldState>({
	disabled: true,
	sources: {},
	saved: {},
	effective: {},
	error: () => undefined,
});

/** 说明入口支持触屏点击、键盘聚焦与 Escape。 */
export function PolicyHelp({ label, children }: { label: string; children: ReactNode }) {
	const [open, setOpen] = useState(false);
	return (
		<TooltipProvider>
			<Tooltip open={open} onOpenChange={setOpen}>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`${label}说明`}
						aria-expanded={open}
						onPointerDown={(event) => event.preventDefault()}
						onClick={(event) => {
							event.preventDefault();
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onBlur={() => setOpen(false)}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								setOpen(false);
								event.preventDefault();
							}
						}}
					>
						<CircleHelp className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent
					className="max-w-80 animate-none"
					onEscapeKeyDown={() => setOpen(false)}
				>
					{children}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

interface PolicyFieldProps {
	name: string;
	label: string;
	help: string;
	children: (id: string, state: RuntimeFieldState) => ReactNode;
}

function displayValue(value: unknown) {
	if (typeof value === "boolean") return value ? "开启" : "关闭";
	if (Array.isArray(value)) return value.length ? value.join("、") : "无";
	return value === undefined ? "—" : String(value);
}

/** 保持草稿值、保存值、实例实际值和来源同时可见。 */
export function PolicyField({ name, label, help, children }: PolicyFieldProps) {
	const id = useId();
	const state = useContext(RuntimeFieldContext);
	const error = state.error(name);
	const source = state.sources[name];
	return (
		<div className="space-y-2">
			<div className="flex items-center gap-1">
				<Label htmlFor={id}>{label}</Label>
				<PolicyHelp label={label}>{help}</PolicyHelp>
			</div>
			{children(id, state)}
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				<span>保存值：{displayValue(state.saved[name])}</span>
				<span>实例值：{displayValue(state.effective[name])}</span>
				<span>
					来源：
					{source === "override"
						? "站点覆盖"
						: source === "deployment"
							? "部署默认"
							: source === "application"
								? "应用默认"
								: "—"}
				</span>
			</div>
			{error && (
				<p id={`${id}-error`} role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}

interface PolicyNumberProps {
	name: string;
	label: string;
	help: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}
export function PolicyNumber({
	name,
	label,
	help,
	value,
	onChange,
	min = 1,
	max,
	step = 1,
}: PolicyNumberProps) {
	return (
		<PolicyField name={name} label={label} help={help}>
			{(id, state) => (
				<Input
					id={id}
					name={name}
					type="number"
					min={min}
					max={max}
					step={step}
					required
					value={Number.isFinite(value) ? value : ""}
					disabled={state.disabled}
					aria-invalid={!!state.error(name)}
					aria-describedby={state.error(name) ? `${id}-error` : undefined}
					onChange={(event) =>
						onChange(
							event.target.value === "" ? Number.NaN : event.target.valueAsNumber,
						)
					}
				/>
			)}
		</PolicyField>
	);
}

interface PolicySwitchProps {
	name: string;
	label: string;
	help: string;
	value: boolean;
	onChange: (value: boolean) => void;
}
export function PolicySwitch({ name, label, help, value, onChange }: PolicySwitchProps) {
	return (
		<PolicyField name={name} label={label} help={help}>
			{(id, state) => (
				<Switch
					id={id}
					checked={value}
					disabled={state.disabled}
					onCheckedChange={onChange}
					aria-invalid={!!state.error(name)}
					aria-describedby={state.error(name) ? `${id}-error` : undefined}
				/>
			)}
		</PolicyField>
	);
}
