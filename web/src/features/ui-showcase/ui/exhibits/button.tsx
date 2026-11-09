import { Button } from "@violet/ui";
import { ChevronRight, Download, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const VARIANTS = [
	["primary", "主要", "发布"],
	["secondary", "次要", "取消"],
	["outline", "描边", "导出"],
	["ghost", "幽灵", "稍后"],
	["destructive", "危险", "删除"],
	["link", "链接", "查看"],
] as const;

const SIZES = [
	["sm", "小 32"],
	["md", "中 36"],
	["lg", "大 40"],
] as const;

type LoadPhase = "idle" | "busy" | "done";

function SaveButton({ keepWidth }: { keepWidth: boolean }) {
	const [phase, setPhase] = useState<LoadPhase>("idle");
	const click = () => {
		if (phase !== "idle") return;
		setPhase("busy");
		window.setTimeout(() => setPhase("done"), 900);
		window.setTimeout(() => setPhase("idle"), 900 + 1600);
	};
	return (
		<Button
			variant="primary"
			loading={phase === "busy"}
			done={phase === "done" ? "已保存" : undefined}
			loadingText={keepWidth ? undefined : "发布中…"}
			onClick={click}
		>
			保存
		</Button>
	);
}

function Stack({ caption, children }: { caption: string; children: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-1">
			<span className="text-12 text-muted-foreground">{caption}</span>
			<div className="flex items-center gap-2">{children}</div>
		</div>
	);
}

function Family({ heading, children }: { heading: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-xs text-muted-foreground">{heading}</span>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
		</div>
	);
}

function ButtonFamily({ state }: ExhibitRenderProps) {
	const loading = state === "loading";
	const disabled = state === "disabled";
	return (
		<div className="flex flex-col items-start gap-4">
			{VARIANTS.map(([variant, label, text]) => (
				<Family key={variant} heading={label}>
					<Button
						variant={variant}
						loading={loading}
						disabled={disabled}
						loadingText="发布中…"
					>
						{text}
					</Button>
					<Button
						variant={variant}
						size="sm"
						leftIcon={<Download aria-hidden="true" />}
						loading={loading}
						disabled={disabled}
					>
						下载
					</Button>
					<Button
						variant={variant}
						size="sm"
						rightIcon={<ChevronRight aria-hidden="true" />}
						loading={loading}
						disabled={disabled}
					>
						前往
					</Button>
					<Button
						variant={variant}
						iconOnly
						size="sm"
						aria-label="新建"
						loading={loading}
						disabled={disabled}
					>
						<Plus aria-hidden="true" />
					</Button>
				</Family>
			))}
			<Family heading="尺寸">
				{SIZES.map(([size, label]) => (
					<Stack key={size} caption={label}>
						<Button size={size} loading={loading} disabled={disabled}>
							保存
						</Button>
					</Stack>
				))}
				<Stack caption="仅图标">
					<Button
						iconOnly
						size="sm"
						aria-label="新建小"
						loading={loading}
						disabled={disabled}
					>
						<Plus aria-hidden="true" />
					</Button>
					<Button iconOnly aria-label="新建中" loading={loading} disabled={disabled}>
						<Plus aria-hidden="true" />
					</Button>
					<Button
						iconOnly
						size="lg"
						aria-label="新建大"
						loading={loading}
						disabled={disabled}
					>
						<Plus aria-hidden="true" />
					</Button>
				</Stack>
			</Family>
			<Family heading="加载与结果">
				<Stack caption="保持宽度">
					<SaveButton keepWidth />
				</Stack>
				<Stack caption="loadingText">
					<SaveButton keepWidth={false} />
				</Stack>
			</Family>
		</div>
	);
}

export const buttonExhibit: Exhibit = {
	id: "button",
	name: "按钮",
	units: ["button"],
	zone: "shelf",
	category: "action",
	footprint: { width: 420, height: 638 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "loading", label: "加载" },
		{ id: "disabled", label: "禁用" },
	],
	Render: ButtonFamily,
};
