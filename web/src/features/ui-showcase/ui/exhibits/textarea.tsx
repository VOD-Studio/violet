import { Kbd, Textarea, type TextareaProps } from "@violet/ui";
import { ImagePlus, Smile } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/**
 * 页面无法强制真实悬停：外壳与输入框共用悬停变量，用展品自有的 data-demo 样式套用
 * 单元的悬停变量（--v-input-bg-hover / --v-input-shadow-hover），不给单元加演示钩子。
 * 聚焦态不走这里，由展品把第一格真实聚焦。
 */
const DEMO_STATE_CSS = `
[data-demo="hover"] .v-input-control:where(:not([data-disabled],[data-readonly],:focus-within)){background-color:var(--v-input-bg-hover);box-shadow:var(--v-input-shadow-hover)}
`;

/** 每种状态落在输入区上的真实属性；初值只在挂载时生效，切换状态会重新挂载。 */
const STATE_PROPS: Record<string, TextareaProps> = {
	rest: { placeholder: "写点什么…" },
	hover: { defaultValue: "换季的落花太好看了" },
	focus: { placeholder: "写点什么…" },
	filled: { defaultValue: "换季的落花太好看了" },
	invalid: {
		defaultValue: "这段话超出了 200 字的上限……",
		invalid: true,
		"aria-describedby": "textarea-exhibit-error",
	},
	readonly: { defaultValue: "这条评论已经锁定，不能再改", readOnly: true },
	disabled: { defaultValue: "写点什么…", disabled: true },
};

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

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<h3 className="m-0 text-13 font-medium">{title}</h3>
			{children}
		</section>
	);
}

/** 四种形态 × 当前状态；聚焦态让第一格真实聚焦，其余格点击即可真实聚焦。 */
function FormGrid({ state }: ExhibitRenderProps) {
	const firstRef = useRef<HTMLTextAreaElement>(null);
	useEffect(() => {
		if (state === "focus") firstRef.current?.focus({ preventScroll: true });
	}, [state]);
	return (
		<div data-demo={state} className="grid grid-cols-2 gap-x-5 gap-y-4">
			<Cell key={`${state}-autosize`} label="自动增高 · 3–8 行">
				<Textarea
					ref={firstRef}
					aria-label="自动增高示例"
					autoSize
					placeholder="最少 3 行，最多 8 行，再多在里面滚动"
					{...STATE_PROPS[state]}
				/>
			</Cell>
			<Cell label="固定行数 · rows=4">
				<Textarea
					aria-label="固定高度示例"
					rows={4}
					placeholder="固定 4 行，超出在里面滚动"
					{...STATE_PROPS[state]}
				/>
			</Cell>
			<Cell label="带字数 · 60">
				<Textarea
					aria-label="带字数示例"
					autoSize={{ minRows: 2, maxRows: 4 }}
					showCount
					maxLength={60}
					placeholder="一句话简介"
					{...STATE_PROPS[state]}
				/>
			</Cell>
			<Cell label="带操作栏 · ⌘↵ 发送">
				<Textarea
					aria-label="带操作栏示例"
					autoSize={{ minRows: 2, maxRows: 7 }}
					showCount
					maxLength={500}
					placeholder="写下你的评论，支持 Markdown"
					toolbar={
						<>
							<button
								type="button"
								className="v-textarea__action"
								aria-label="插入图片"
							>
								<ImagePlus aria-hidden="true" />
							</button>
							<button
								type="button"
								className="v-textarea__action"
								aria-label="插入表情"
							>
								<Smile aria-hidden="true" />
							</button>
							<span className="ml-auto inline-flex items-center gap-1 text-12 text-muted-foreground">
								<Kbd>⌘</Kbd>
								<Kbd>↵</Kbd>
								发送
							</span>
						</>
					}
					{...STATE_PROPS[state]}
				/>
			</Cell>
		</div>
	);
}

function TextareaFamily({ state }: ExhibitRenderProps) {
	return (
		<div className="flex flex-col gap-6 p-1">
			<style>{DEMO_STATE_CSS}</style>
			<Section title="四种形态">
				<FormGrid state={state} />
			</Section>
		</div>
	);
}

export const textareaExhibit: Exhibit = {
	id: "textarea",
	name: "多行输入",
	units: ["textarea"],
	zone: "field",
	category: "form",
	footprint: { width: 520, height: 560 },
	states: [
		{ id: "rest", label: "静止" },
		{ id: "hover", label: "悬停" },
		{ id: "focus", label: "聚焦" },
		{ id: "filled", label: "已填写" },
		{ id: "invalid", label: "出错" },
		{ id: "readonly", label: "只读" },
		{ id: "disabled", label: "禁用" },
	],
	Render: TextareaFamily,
};
