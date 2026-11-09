import { UploadDropzone, type UploadEntry, UploadQueue } from "@violet/ui";
import { useEffect, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const MB = 1024 * 1024;

function initialEntries(state: string): UploadEntry[] {
	const examples: UploadEntry[] = [
		{
			id: "queued",
			name: "那拉提傍晚.jpg",
			size: 3.2 * MB,
			status: "queued",
			progress: 0,
			kind: "image",
		},
		{
			id: "uploading",
			name: "独库公路的傍晚与沿途山色记录-01.jpg",
			size: 4.8 * MB,
			status: "uploading",
			progress: 62,
			kind: "image",
		},
		{
			id: "waiting",
			name: "玉希莫勒盖.jpg",
			size: 2.7 * MB,
			status: "waiting",
			progress: 35,
			kind: "image",
			retryAt: Date.now() + 4000,
		},
		{
			id: "done",
			name: "海边.jpg",
			size: 3.6 * MB,
			status: "done",
			progress: 100,
			kind: "image",
			description: "已上传 · 1920 × 1280",
		},
		{
			id: "error",
			name: "库车戈壁.jpg",
			size: 5 * MB,
			status: "error",
			progress: 40,
			kind: "image",
			error: "网络中断",
			retryAt: Date.now() + 3000,
		},
		{
			id: "cancelled",
			name: "秋天的桂花.jpg",
			size: 1.1 * MB,
			status: "cancelled",
			progress: 0,
			kind: "image",
		},
	];
	if (state === "mixed" || state === "collapsed") return examples;
	if (state === "empty") return [];
	if (state === "cancelling")
		return [{ ...examples[1], cancelling: true, description: "正在确认取消…" }];
	if (["policy-loading", "policy-error", "paused"].includes(state)) return [examples[0]];
	return examples.filter((entry) => entry.status === state);
}

function UploadDemo({ state }: ExhibitRenderProps) {
	const [items, setItems] = useState(() => initialEntries(state));
	const [running, setRunning] = useState(false);
	const [policy, setPolicy] = useState<"ready" | "loading" | "error" | "paused">(
		state === "policy-loading"
			? "loading"
			: state === "policy-error"
				? "error"
				: state === "paused"
					? "paused"
					: "ready",
	);
	const [dragActive, setDragActive] = useState(false);
	const [message, setMessage] = useState(
		"选择本机文件可演示排队、取消与重试；展品不向服务器上传。",
	);
	const input = useRef<HTMLInputElement>(null);
	const previews = useRef(new Map<string, string>());

	useEffect(
		() => () => {
			for (const url of previews.current.values()) URL.revokeObjectURL(url);
		},
		[],
	);

	useEffect(() => {
		if (!running || policy !== "ready") return;
		const timer = window.setInterval(() => {
			setItems((current) => {
				let active = current.filter((entry) => entry.status === "uploading").length;
				return current.map((entry): UploadEntry => {
					if (entry.status === "uploading") {
						const progress = Math.min(100, entry.progress + 12);
						return {
							...entry,
							progress,
							status: progress === 100 ? "done" : "uploading",
						};
					}
					if (entry.status === "queued" && active < 2) {
						active++;
						return { ...entry, status: "uploading" };
					}
					return entry;
				});
			});
		}, 250);
		return () => window.clearInterval(timer);
	}, [running, policy]);

	useEffect(() => {
		if (
			running &&
			!items.some((entry) => entry.status === "queued" || entry.status === "uploading")
		)
			setRunning(false);
	}, [items, running]);

	const select = (files: FileList | null) => {
		const selected = Array.from(files ?? []);
		const entries = selected.map((file): UploadEntry => {
			const id = crypto.randomUUID();
			const thumbnail = file.type.startsWith("image/")
				? URL.createObjectURL(file)
				: undefined;
			if (thumbnail) previews.current.set(id, thumbnail);
			return {
				id,
				name: file.name,
				size: file.size,
				progress: 0,
				status: "queued",
				thumbnail,
				kind: file.type.startsWith("image/")
					? "image"
					: file.type.startsWith("video/")
						? "video"
						: file.type.startsWith("audio/")
							? "audio"
							: "file",
			};
		});
		setItems((current) => [...current, ...entries]);
		setRunning(true);
		setMessage(`已选择 ${entries.length} 个文件，正在演示上传。`);
	};
	const remove = (id: string) => {
		const url = previews.current.get(id);
		if (url) URL.revokeObjectURL(url);
		previews.current.delete(id);
		setItems((current) => current.filter((entry) => entry.id !== id));
	};
	const cancel = (id: string) => {
		setItems((current) =>
			current.map((entry) =>
				entry.id === id ? { ...entry, status: "cancelled", cancelling: false } : entry,
			),
		);
		setMessage("已取消这一项，已完成的文件仍保留。");
	};
	return (
		<div className="flex w-full flex-col items-center gap-4" data-upload-demo={state}>
			<input
				ref={input}
				type="file"
				multiple
				className="hidden"
				aria-label="选择演示文件"
				onChange={(event) => {
					select(event.currentTarget.files);
					event.currentTarget.value = "";
				}}
			/>
			<UploadDropzone
				className="w-90"
				dragActive={dragActive}
				hint="支持拖放；文件只在本机演示"
				onClick={() => input.current?.click()}
				onDragOver={(event) => {
					event.preventDefault();
					setDragActive(true);
				}}
				onDragLeave={() => setDragActive(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragActive(false);
					select(event.dataTransfer.files);
				}}
			>
				上传文件
			</UploadDropzone>
			<UploadQueue
				items={items}
				concurrency={2}
				policy={policy}
				defaultCollapsed={state === "collapsed"}
				onRetryPolicy={() => {
					setPolicy("ready");
					setRunning(true);
				}}
				onResume={() => {
					setPolicy("ready");
					setRunning(true);
				}}
				onCancel={cancel}
				onRetry={(id) => {
					setItems((current) =>
						current.map((entry) =>
							entry.id === id
								? {
										...entry,
										status: "uploading",
										retryAt: undefined,
										error: undefined,
									}
								: entry,
						),
					);
					setRunning(true);
				}}
				onRemove={remove}
				onCancelAll={() => {
					for (const entry of items)
						if (!["done", "cancelled"].includes(entry.status)) cancel(entry.id);
				}}
				onClearCompleted={() => {
					for (const entry of items)
						if (["done", "cancelled"].includes(entry.status)) remove(entry.id);
				}}
			/>
			<output
				className="max-w-90 text-center text-xs text-muted-foreground"
				aria-live="polite"
			>
				{message}
			</output>
		</div>
	);
}

function UploadSpecimen(props: ExhibitRenderProps) {
	return <UploadDemo key={props.state} {...props} />;
}

export const uploadExhibit: Exhibit = {
	id: "upload",
	name: "上传入口与队列",
	units: ["upload"],
	zone: "field",
	category: "form",
	footprint: { width: 480, height: 640 },
	states: [
		{ id: "mixed", label: "全部状态" },
		{ id: "queued", label: "排队" },
		{ id: "uploading", label: "上传中" },
		{ id: "waiting", label: "限流等待" },
		{ id: "done", label: "完成" },
		{ id: "error", label: "失败与重试" },
		{ id: "cancelled", label: "已取消" },
		{ id: "cancelling", label: "确认取消" },
		{ id: "policy-loading", label: "配置读取中" },
		{ id: "policy-error", label: "配置失败" },
		{ id: "paused", label: "手动恢复" },
		{ id: "collapsed", label: "收起" },
		{ id: "empty", label: "空队列" },
	],
	Render: UploadSpecimen,
};
