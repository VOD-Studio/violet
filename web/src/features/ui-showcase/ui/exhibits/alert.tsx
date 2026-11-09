import { Alert, Button, Empty, ProgressBar, ProgressRing, type ProgressStatus } from "@violet/ui";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function ProgressDemo() {
	const [value, setValue] = useState(24);
	const [status, setStatus] = useState<ProgressStatus>("process");
	return (
		<div className="flex flex-col gap-4">
			<ProgressBar
				value={value}
				status={status}
				label="上传 cover-season.webp"
				hint={
					status === "success"
						? "已完成"
						: status === "error"
							? "网络中断"
							: `${value} / 100 MB`
				}
				segments={{ count: 5, active: Math.min(5, Math.floor(value / 20)) }}
			/>
			<div className="flex flex-wrap gap-2">
				<Button
					size="sm"
					onClick={() => {
						const next = Math.min(100, value + 26);
						setValue(next);
						setStatus(next === 100 ? "success" : "process");
					}}
				>
					前进
				</Button>
				<Button size="sm" variant="ghost" onClick={() => setStatus("error")}>
					模拟失败
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => {
						setValue(0);
						setStatus("process");
					}}
				>
					重置
				</Button>
			</div>
		</div>
	);
}

function FractionDemo() {
	return (
		<div className="flex flex-col gap-4">
			<ProgressBar
				value={21}
				label="路线图"
				hint="第 3 / 5 个阶段"
				segments={{ count: 5, active: 3 }}
			/>
			<ProgressBar
				value={100}
				status="success"
				label="上传 cover-season.webp"
				hint="已完成"
			/>
		</div>
	);
}

function RingDemo() {
	const [read, setRead] = useState(13);
	return (
		<div className="flex flex-col items-start gap-4">
			<ProgressRing
				value={(read / 20) * 100}
				label="本月阅读目标"
				description={`已读 ${read} / 20 篇`}
			/>
			<Button size="sm" variant="secondary" onClick={() => setRead(Math.min(20, read + 1))}>
				读完一篇
			</Button>
		</div>
	);
}

function ToneDemo({
	tone,
	state,
}: {
	tone: "info" | "success" | "warning" | "danger";
	state: string;
}) {
	const [visible, setVisible] = useState(true);
	if (!visible) {
		return (
			<Button size="sm" variant="secondary" onClick={() => setVisible(true)}>
				恢复提示
			</Button>
		);
	}
	return (
		<div className="w-full max-w-130">
			<Alert
				tone={tone}
				title={
					state === "info"
						? "草稿已自动保存"
						: state === "success"
							? "发布成功"
							: state === "warning"
								? "封面尺寸偏小"
								: "同步失败"
				}
				description={
					state === "info"
						? "离开页面也不会丢失。"
						: state === "success"
							? "文章已出现在博客首页。"
							: state === "warning"
								? "建议宽度不小于 1600px，否则分享卡片会模糊。"
								: "GitHub 令牌已过期，推文没有同步过去。"
				}
				action={
					state === "success"
						? { label: "查看", href: "#published" }
						: state === "warning"
							? { label: "换一张", onClick: () => undefined }
							: state === "danger"
								? { label: "重新授权", onClick: () => undefined }
								: undefined
				}
				onDismiss={() => setVisible(false)}
			/>
		</div>
	);
}

function CompactAlerts() {
	return (
		<div className="flex w-full max-w-120 flex-col gap-3">
			<Alert compact tone="warning" title="改了站点地址后，旧地址会跳转 30 天。" />
			<Alert compact title="这些设置只影响你自己，不会改变别人看到的样子。" />
		</div>
	);
}

function EmptyDefault() {
	return (
		<div className="flex h-full w-full max-w-100 flex-col items-center justify-center">
			<Empty
				title="还没有想法"
				description="写下第一条后会出现在这里。"
				action={<Button variant="primary" size="sm">记一条</Button>}
			/>
		</div>
	);
}

function EmptyFilter() {
	return (
		<div className="flex h-full w-full max-w-100 flex-col items-center justify-center">
			<Empty
				variant="plain"
				title="没有符合条件的文章"
				description="标签「Rust」· 系列「Yggdrasil」"
				action={
					<Button size="sm" variant="secondary">
						清除筛选
					</Button>
				}
			/>
		</div>
	);
}

function EmptyPanel() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="w-75 rounded-16 border border-border bg-card p-7 shadow-soft">
				<Empty variant="compact" title="没有新消息" />
			</div>
		</div>
	);
}

function FeedbackFamily({ state }: ExhibitRenderProps) {
	return (
		<div className="size-full p-6">
			{state === "fraction" ? (
				<FractionDemo />
			) : state === "ring" ? (
				<RingDemo />
			) : state === "info" ||
				state === "success" ||
				state === "warning" ||
				state === "danger" ? (
				<ToneDemo tone={state} state={state} />
			) : state === "compact" ? (
				<CompactAlerts />
			) : state === "empty" ? (
				<EmptyDefault />
			) : state === "empty-filter" ? (
				<EmptyFilter />
			) : state === "empty-panel" ? (
				<EmptyPanel />
			) : (
				<ProgressDemo />
			)}
		</div>
	);
}

export const alertExhibit: Exhibit = {
	id: "alert",
	name: "提示与空状态",
	units: ["progress", "alert", "empty"],
	zone: "content",
	category: "feedback",
	footprint: { width: 520, height: 240 },
	states: [
		{ id: "progress", label: "进度条" },
		{ id: "fraction", label: "分段进度" },
		{ id: "ring", label: "进度圆环" },
		{ id: "info", label: "信息提示" },
		{ id: "success", label: "成功提示" },
		{ id: "warning", label: "警告提示" },
		{ id: "danger", label: "危险提示" },
		{ id: "compact", label: "紧凑提示" },
		{ id: "empty", label: "空状态" },
		{ id: "empty-filter", label: "筛选无结果" },
		{ id: "empty-panel", label: "面板空状态" },
	],
	Render: FeedbackFamily,
};
