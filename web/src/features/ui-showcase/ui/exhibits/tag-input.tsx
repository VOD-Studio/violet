import { Field, TagInput, type TagRejection } from "@violet/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

type Variant = "filled" | "outline" | "underline" | "plain";
type ControlSize = "sm" | "md" | "lg";

const VARIANTS: { variant: Variant; label: string }[] = [
	{ variant: "filled", label: "填充" },
	{ variant: "outline", label: "描边" },
	{ variant: "underline", label: "下划线" },
	{ variant: "plain", label: "无框" },
];

const SIZES: { size: ControlSize; label: string }[] = [
	{ size: "sm", label: "小 · 32" },
	{ size: "md", label: "中 · 36" },
	{ size: "lg", label: "大 · 40" },
];

const LIBRARY = [
	"Go",
	"Rust",
	"React",
	"TypeScript",
	"Postgres",
	"Redis",
	"Docker",
	"Tailwind",
	"Kubernetes",
	"GraphQL",
];

const SEASONS = ["春", "夏", "秋", "冬"];

const MAX_TAGS = 10;
const MAX_LENGTH = 8;

const validateLength = (tag: string) =>
	tag.length > MAX_LENGTH ? `标签最长 ${MAX_LENGTH} 个字` : null;

/** 把 onReject 的原因接到表单项的错误位：重复说明停 1600ms，其余停 3 秒；值一变就清掉。 */
function useRejectMessage() {
	const [message, setMessage] = useState<string | undefined>();
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);
	const clear = () => {
		clearTimeout(timer.current);
		setMessage(undefined);
	};
	return {
		message,
		clear,
		onReject: (rejection: TagRejection) => {
			clearTimeout(timer.current);
			setMessage(rejection.message);
			timer.current = window.setTimeout(
				() => setMessage(undefined),
				rejection.reason === "duplicate" ? 1600 : 3000,
			);
		},
	};
}

function Stage({
	stageRef,
	children,
}: {
	stageRef: (node: HTMLDivElement | null) => void;
	children: ReactNode;
}) {
	return (
		<div
			ref={stageRef}
			className="relative mx-auto flex size-full max-w-132 flex-col gap-5 px-8 pt-6 *:min-w-0"
		>
			{children}
		</div>
	);
}

function BasicStage() {
	const { ref } = useStageContainer();
	const [tags, setTags] = useState([
		"Go",
		"Rust",
		"TypeScript",
		"Postgres",
		"Redis",
		"Docker",
		"Tailwind",
	]);
	const reject = useRejectMessage();
	return (
		<Stage stageRef={ref}>
			<Field
				label="标签"
				hint="回车、逗号或顿号生成标签"
				error={reject.message}
				count={{ value: tags.length, max: MAX_TAGS }}
			>
				<TagInput
					value={tags}
					onValueChange={(next) => {
						reject.clear();
						setTags(next);
					}}
					max={MAX_TAGS}
					onReject={reject.onReject}
				/>
			</Field>
		</Stage>
	);
}

function SuggestionsStage() {
	const { ref, container } = useStageContainer();
	const [tags, setTags] = useState(["React"]);
	return (
		<Stage stageRef={ref}>
			<Field
				label="文章标签"
				hint="可以从建议里选，也可以创建新的"
				count={{ value: tags.length, max: MAX_TAGS }}
			>
				<TagInput
					value={tags}
					onValueChange={setTags}
					max={MAX_TAGS}
					suggestions={LIBRARY}
					container={container}
					collisionBoundary={container}
				/>
			</Field>
		</Stage>
	);
}

function MaxStage() {
	const { ref } = useStageContainer();
	const [tags, setTags] = useState(SEASONS.slice(0, 3));
	return (
		<Stage stageRef={ref}>
			<Field
				label="季节"
				hint="最多选三个"
				error={tags.length >= 3 ? "最多 3 个，删掉一个才能再加" : undefined}
				count={{ value: tags.length, max: 3 }}
			>
				<TagInput value={tags} onValueChange={setTags} max={3} />
			</Field>
		</Stage>
	);
}

function FeedbackStage() {
	const { ref } = useStageContainer();
	const [duplicated, setDuplicated] = useState(["Go", "Rust"]);
	const [checked, setChecked] = useState(["react"]);
	const duplicateReject = useRejectMessage();
	const checkReject = useRejectMessage();
	return (
		<Stage stageRef={ref}>
			<Field label="重复的标签" hint="再输入一次 go 试试" error={duplicateReject.message}>
				<TagInput
					value={duplicated}
					onValueChange={(next) => {
						duplicateReject.clear();
						setDuplicated(next);
					}}
					onReject={duplicateReject.onReject}
				/>
			</Field>
			<Field
				label={`笔记标签（最长 ${MAX_LENGTH} 个字，自动去掉 #）`}
				hint="试试输入 #一个超过八个字的很长很长的标签"
				error={checkReject.message}
			>
				<TagInput
					value={checked}
					onValueChange={(next) => {
						checkReject.clear();
						setChecked(next);
					}}
					normalize={(raw) => raw.replace(/^#/, "")}
					validate={validateLength}
					onReject={checkReject.onReject}
				/>
			</Field>
		</Stage>
	);
}

type CellState = "rest" | "invalid" | "valid" | "loading" | "readonly" | "disabled";

const CELL_STATES: { id: CellState; label: string }[] = [
	{ id: "rest", label: "默认" },
	{ id: "invalid", label: "出错" },
	{ id: "valid", label: "通过" },
	{ id: "loading", label: "加载" },
	{ id: "readonly", label: "只读" },
	{ id: "disabled", label: "禁用" },
];

function Caption({ children }: { children: ReactNode }) {
	return <span className="text-12 text-muted-foreground">{children}</span>;
}

function StateTagInput({
	state,
	variant,
	size,
	label,
	empty = false,
}: {
	state: CellState;
	variant: Variant;
	size: ControlSize;
	label: string;
	empty?: boolean;
}) {
	return (
		<TagInput
			aria-label={label}
			variant={variant}
			controlSize={size}
			defaultValue={empty || state === "loading" ? [] : ["Go"]}
			placeholder={state === "loading" ? "加载中…" : undefined}
			invalid={state === "invalid"}
			valid={state === "valid"}
			loading={state === "loading"}
			readOnly={state === "readonly"}
			disabled={state === "disabled"}
		/>
	);
}

function StateGrid() {
	return (
		<div className="flex flex-col gap-5 p-1">
			<div className="grid grid-cols-[2.5rem_repeat(4,minmax(0,1fr))] items-start gap-x-2 gap-y-2.5">
				<span />
				{VARIANTS.map(({ variant, label }) => (
					<Caption key={variant}>{label}</Caption>
				))}
				{CELL_STATES.map(({ id, label }) => (
					<RowOf key={id} state={id} label={label} />
				))}
			</div>
			<div className="grid grid-cols-3 items-start gap-x-3">
				{SIZES.map(({ size, label }) => (
					<div key={size} className="flex min-w-0 flex-col gap-1.5">
						<Caption>{label}</Caption>
						<StateTagInput
							state="rest"
							variant="outline"
							size={size}
							label={`${label}标签输入`}
							empty
						/>
					</div>
				))}
			</div>
		</div>
	);
}

function RowOf({ state, label }: { state: CellState; label: string }) {
	return (
		<>
			<Caption>{label}</Caption>
			{VARIANTS.map(({ variant, label: variantLabel }) => (
				<StateTagInput
					key={variant}
					state={state}
					variant={variant}
					size="md"
					label={`${variantLabel}${label}标签输入`}
				/>
			))}
		</>
	);
}

function TagInputStage({ state }: ExhibitRenderProps) {
	if (state === "suggestions") return <SuggestionsStage />;
	if (state === "max") return <MaxStage />;
	if (state === "feedback") return <FeedbackStage />;
	if (state === "states") return <StateGrid />;
	return <BasicStage />;
}

export const tagInputExhibit: Exhibit = {
	id: "tag-input",
	name: "标签输入",
	units: ["tag-input"],
	zone: "field",
	category: "form",
	footprint: { width: 760, height: 440 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "suggestions", label: "带建议" },
		{ id: "max", label: "达上限" },
		{ id: "feedback", label: "重复与校验" },
		{ id: "states", label: "状态" },
	],
	Render: TagInputStage,
};
