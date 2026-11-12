import { Input, type InputProps, Kbd, SearchInput } from "@violet/ui";
import { Lock, Mail } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/**
 * 页面无法强制真实悬停：悬停态用包裹元素的 data-demo 属性，在展品自有的样式里套用
 * 单元自己的悬停变量（--v-input-bg-hover / --v-input-shadow-hover），不给单元加演示钩子。
 * 聚焦态不走这里，由展品把第一格真实聚焦。
 */
const DEMO_STATE_CSS = `
[data-demo="hover"] .v-input-control:where(:not([data-disabled],[data-readonly],:focus-within)){background-color:var(--v-input-bg-hover);box-shadow:var(--v-input-shadow-hover)}
[data-demo="hover"] .v-input-control__action--clear{opacity:1;pointer-events:auto}
`;

const VARIANTS: { variant: NonNullable<InputProps["variant"]>; label: string }[] = [
	{ variant: "filled", label: "填充" },
	{ variant: "outline", label: "描边" },
	{ variant: "underline", label: "下划线" },
	{ variant: "plain", label: "无框" },
];

/** 每种状态落在输入框上的真实属性；初值只在挂载时生效，切换状态会重新挂载。 */
const STATE_PROPS: Record<string, InputProps> = {
	rest: { placeholder: "显示名称" },
	hover: { defaultValue: "Violet", clearable: true },
	focus: { placeholder: "显示名称" },
	filled: { defaultValue: "Violet", clearable: true },
	invalid: { defaultValue: "Violet", invalid: true, clearable: true },
	valid: { defaultValue: "Violet", valid: true },
	loading: { defaultValue: "Violet", loading: true },
	readonly: { defaultValue: "Violet", readOnly: true },
	disabled: { defaultValue: "Violet", disabled: true, clearable: true },
};

const SIZES: { size: NonNullable<InputProps["controlSize"]>; label: string }[] = [
	{ size: "sm", label: "小 · 32" },
	{ size: "md", label: "中 · 36" },
	{ size: "lg", label: "大 · 40" },
];

function Caption({ children }: { children: ReactNode }) {
	return <span className="text-12 text-muted-foreground">{children}</span>;
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<Caption>{label}</Caption>
			{children}
		</div>
	);
}

/** 四种变体 × 当前状态；聚焦态让第一格真实聚焦，其余格点击即可真实聚焦。 */
function VariantGrid({ state }: ExhibitRenderProps) {
	const firstRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (state === "focus") firstRef.current?.focus({ preventScroll: true });
	}, [state]);
	return (
		<div data-demo={state} className="grid grid-cols-2 gap-x-5 gap-y-4">
			{VARIANTS.map(({ variant, label }, index) => (
				<Cell key={`${state}-${variant}`} label={label}>
					<Input
						ref={index === 0 ? firstRef : undefined}
						variant={variant}
						aria-label={`${label}输入框`}
						{...STATE_PROPS[state]}
					/>
				</Cell>
			))}
		</div>
	);
}

/** 由类型与槽组合出的常见形态；触屏键盘所需的 inputMode 与 autoComplete 一并写全。 */
function KindGrid() {
	return (
		<div className="grid grid-cols-2 gap-x-5 gap-y-4">
			<Cell label="文本">
				<Input aria-label="显示名称" placeholder="显示名称" autoComplete="nickname" />
			</Cell>
			<Cell label="邮箱">
				<Input
					aria-label="邮箱"
					type="email"
					inputMode="email"
					autoComplete="email"
					placeholder="name@example.com"
					leading={<Mail aria-hidden="true" />}
				/>
			</Cell>
			<Cell label="密码">
				<Input
					aria-label="密码"
					type="password"
					autoComplete="current-password"
					placeholder="至少 8 位"
					leading={<Lock aria-hidden="true" />}
					passwordToggle
				/>
			</Cell>
			<Cell label="搜索">
				<SearchInput
					aria-label="搜索文章与手记"
					placeholder="搜索文章与手记"
					shortcut={["mod", "K"]}
				/>
			</Cell>
			<Cell label="网址">
				<Input
					aria-label="网址"
					type="url"
					inputMode="url"
					autoComplete="url"
					placeholder="example.com"
					leading="https://"
				/>
			</Cell>
			<Cell label="用户名">
				<Input
					aria-label="用户名"
					autoComplete="username"
					autoCapitalize="none"
					spellCheck={false}
					placeholder="rua"
					leading="@"
					trailing=".rua.plus"
				/>
			</Cell>
			<Cell label="只读复制">
				<Input
					aria-label="分享链接"
					readOnly
					copyable
					copyLabel="复制链接"
					defaultValue="https://xunrua.top/p/season"
				/>
			</Cell>
			<Cell label="带单位">
				<Input
					aria-label="宽度"
					inputMode="decimal"
					placeholder="0"
					classNames={{ input: "font-mono tabular-nums" }}
					trailing="px"
				/>
			</Cell>
			<Cell label="带键帽">
				<Input aria-label="发送给" placeholder="发送给" trailing={<Kbd>↵</Kbd>} />
			</Cell>
			<Cell label="验证码">
				<Input
					aria-label="验证码"
					inputMode="numeric"
					autoComplete="one-time-code"
					maxLength={6}
					placeholder="6 位数字"
					classNames={{ input: "font-mono tabular-nums" }}
				/>
			</Cell>
		</div>
	);
}

/** 三档尺寸：32 / 36 / 40，触屏各加 4。 */
function SizeRow() {
	return (
		<div className="grid grid-cols-3 gap-x-5">
			{SIZES.map(({ size, label }) => (
				<Cell key={size} label={label}>
					<Input
						aria-label={`${label}输入框`}
						controlSize={size}
						placeholder="显示名称"
					/>
				</Cell>
			))}
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<h3 className="m-0 text-13 font-medium">{title}</h3>
			{children}
		</section>
	);
}

function InputFamily({ state }: ExhibitRenderProps) {
	return (
		<div className="flex flex-col gap-6 p-1">
			<style>{DEMO_STATE_CSS}</style>
			<Section title="四种变体">
				<VariantGrid state={state} />
			</Section>
			<Section title="类型形态">
				<KindGrid />
			</Section>
			<Section title="三档尺寸">
				<SizeRow />
			</Section>
		</div>
	);
}

export const inputExhibit: Exhibit = {
	id: "input",
	name: "输入框",
	units: ["input"],
	zone: "field",
	category: "form",
	footprint: { width: 520, height: 760 },
	states: [
		{ id: "rest", label: "静止" },
		{ id: "hover", label: "悬停" },
		{ id: "focus", label: "聚焦" },
		{ id: "filled", label: "已填写" },
		{ id: "invalid", label: "出错" },
		{ id: "valid", label: "通过" },
		{ id: "loading", label: "加载" },
		{ id: "readonly", label: "只读" },
		{ id: "disabled", label: "禁用" },
	],
	Render: InputFamily,
};
