import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { useFileSelection } from "@features/upload/hooks/use-file-selection";
import { useUploadQueue } from "@features/upload/hooks/use-upload-queue";
import { imageUrl } from "@shared/lib/image-url";
import { Button, UploadDropzone, type UploadEntry, UploadQueue } from "@violet/ui";
import { Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** 上传结果至少含可访问 url；thumbnail 为后端生成的缩略图。 */
export interface UploadResult {
	url: string;
	thumbnail?: string;
}

/** 原生文件选择与站点上传队列；成功回调保留原始文件。 */
export interface UploaderProps<T extends UploadResult> {
	/** 省略时使用默认分片上传，执行器须保留取消信号与真实成功结果。 */
	upload?: (
		file: File,
		onProgress?: (percent: number) => void,
		signal?: AbortSignal,
	) => Promise<T>;
	/** 每个文件成功时立即通知，适用于图库、人设与表情。 */
	onUploaded?: (result: T, file: File) => void;
	/** 队列停止运行或用户提前展示时，通知尚未展示的成功结果。 */
	onBatchUploaded?: (results: readonly { result: T; file: File }[]) => void;
	onPendingUploadedChange?: (count: number) => void;
	/** 父级关闭入口应在存在未完成上传时确认。 */
	onBusyChange?: (busy: boolean) => void;
	/** 仅禁止追加选择，不中断已排队任务。 */
	disabled?: boolean;
	/** 仅默认分片上传模式生效。 @default "material" */
	purpose?: string;
	/** 接受的 MIME 或扩展名，逗号分隔。 */
	accept?: string;
	/** 单文件最大字节。 */
	maxSize?: number;
	/** 每次选择的最大文件数。 */
	maxFiles?: number;
	label?: string;
	hint?: string;
	/** button 入口接管当前页面的文件拖放；dropzone 只接收区域内拖放。 */
	entry?: "dropzone" | "button";
	className?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;
let globalDropOwner: symbol | undefined;

/** 将站点执行器与文件预览连接到展示型 UploadQueue。 */
export function Uploader<T extends UploadResult>({
	upload: customUpload,
	onUploaded,
	onBatchUploaded,
	onPendingUploadedChange,
	purpose = "material",
	onBusyChange,
	disabled = false,
	accept = "image/*",
	maxSize = DEFAULT_MAX_SIZE,
	maxFiles = 20,
	label,
	hint,
	entry = "dropzone",
	className,
}: UploaderProps<T>) {
	const { queue, items, busy, now, policy } = useUploadQueue<T>(onBusyChange);
	const [isDragActive, setIsDragActive] = useState(false);
	const [closeRequested, setCloseRequested] = useState(false);
	const [pendingCount, setPendingCount] = useState(0);
	const previews = useRef(new Map<string, string>());
	const pending = useRef<{ result: T; file: File }[]>([]);
	const mounted = useRef(true);
	// 并发完成时读取最新回调，避免消费者用旧列表覆盖其他文件的结果。
	const callbacks = useRef({ onUploaded, onBatchUploaded, onPendingUploadedChange });
	callbacks.current = { onUploaded, onBatchUploaded, onPendingUploadedChange };
	const selectionDisabled = disabled || closeRequested;
	const { uploadFile: chunkedUpload } = useChunkedUpload({ purpose });

	const flushUploaded = useCallback(() => {
		if (pending.current.length === 0) return;
		const results = pending.current;
		pending.current = [];
		if (mounted.current) setPendingCount(0);
		try {
			callbacks.current.onBatchUploaded?.(results);
		} catch (error) {
			console.error("上传批次成功回调失败", error);
		}
	}, []);

	useEffect(() => {
		mounted.current = true;
		const urls = previews.current;
		return () => {
			mounted.current = false;
			for (const url of urls.values()) URL.revokeObjectURL(url);
			urls.clear();
			flushUploaded();
			callbacks.current.onPendingUploadedChange?.(0);
		};
	}, [flushUploaded]);

	useEffect(() => {
		callbacks.current.onPendingUploadedChange?.(pendingCount);
	}, [pendingCount]);

	useEffect(() => {
		const localIds = new Set(items.filter((item) => !item.result?.url).map((item) => item.id));
		for (const [id, url] of previews.current) {
			if (!localIds.has(id)) {
				URL.revokeObjectURL(url);
				previews.current.delete(id);
			}
		}
	}, [items]);

	// 错误项已停止运行，但仍保留离页保护和重试入口。
	const batchRunning = items.some(
		(item) =>
			item.cancelling ||
			item.status === "queued" ||
			item.status === "uploading" ||
			item.status === "waiting",
	);
	useEffect(() => {
		if (pendingCount > 0 && !batchRunning) flushUploaded();
	}, [batchRunning, pendingCount, flushUploaded]);

	useEffect(() => {
		if (!closeRequested || busy) return;
		for (const item of items) queue.remove(item.id);
		setCloseRequested(false);
	}, [closeRequested, busy, items, queue]);

	const uploadFiles = useCallback(
		(files: File[]) => {
			const ids = queue.add(
				files,
				(file, onProgress, signal) =>
					customUpload
						? customUpload(file, onProgress, signal)
						: (chunkedUpload(
								file,
								(progress) => onProgress(progress.percent),
								signal,
							) as unknown as Promise<T>),
				(result, file) => {
					if (callbacks.current.onBatchUploaded) {
						pending.current.push({ result, file });
						if (mounted.current) setPendingCount(pending.current.length);
						else flushUploaded();
					}
					try {
						callbacks.current.onUploaded?.(result, file);
					} finally {
						toast.success(`「${file.name}」上传成功`);
					}
				},
			);
			for (const [index, file] of files.entries()) {
				const id = ids[index];
				if (id && file.type.startsWith("image/")) {
					previews.current.set(id, URL.createObjectURL(file));
				}
			}
		},
		[queue, customUpload, chunkedUpload, flushUploaded],
	);
	const { inputProps, open, selectFiles } = useFileSelection({
		accept,
		maxSize,
		maxFiles,
		disabled: selectionDisabled,
		onSelect: uploadFiles,
	});

	useEffect(() => {
		if (entry !== "button" || globalDropOwner !== undefined) return;
		const owner = Symbol("upload-drop");
		globalDropOwner = owner;
		let depth = 0;
		const reset = () => {
			depth = 0;
			setIsDragActive(false);
		};
		const isFileDrag = (event: DragEvent) =>
			Array.from(event.dataTransfer?.types ?? []).includes("Files");
		const enter = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();
			depth++;
			if (!selectionDisabled) setIsDragActive(true);
		};
		const over = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = selectionDisabled ? "none" : "copy";
			}
		};
		const leave = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			depth = Math.max(0, depth - 1);
			if (depth === 0) reset();
		};
		const drop = (event: DragEvent) => {
			if (!isFileDrag(event)) return;
			event.preventDefault();
			// 捕获阶段只交给页面入口，嵌套的上传区不重复接收同一次拖放。
			event.stopPropagation();
			reset();
			if (event.dataTransfer) selectFiles(event.dataTransfer.files);
		};
		window.addEventListener("dragenter", enter, true);
		window.addEventListener("dragover", over, true);
		window.addEventListener("dragleave", leave, true);
		window.addEventListener("drop", drop, true);
		window.addEventListener("dragend", reset);
		window.addEventListener("blur", reset);
		return () => {
			window.removeEventListener("dragenter", enter, true);
			window.removeEventListener("dragover", over, true);
			window.removeEventListener("dragleave", leave, true);
			window.removeEventListener("drop", drop, true);
			window.removeEventListener("dragend", reset);
			window.removeEventListener("blur", reset);
			if (globalDropOwner === owner) globalDropOwner = undefined;
		};
	}, [entry, selectFiles, selectionDisabled]);

	const cancelAll = () => {
		for (const item of queue.getSnapshot()) {
			if (item.status !== "done" && item.status !== "cancelled" && !item.cancelling) {
				queue.cancel(item.id);
			}
		}
	};
	const close = () => {
		if (closeRequested) return;
		if (busy) {
			if (!window.confirm("仍有文件未完成。关闭将取消未完成项，是否关闭？")) return;
			setCloseRequested(true);
			cancelAll();
		} else {
			flushUploaded();
			for (const item of items) queue.remove(item.id);
		}
	};
	const clearCompleted = () => {
		for (const item of items) {
			if (item.status === "done" || item.status === "cancelled") queue.remove(item.id);
		}
	};
	const entries: UploadEntry[] = items.map((item) => {
		const kind = item.file.type.startsWith("image/")
			? "image"
			: item.file.type.startsWith("video/")
				? "video"
				: item.file.type.startsWith("audio/")
					? "audio"
					: "file";
		return {
			id: item.id,
			name: item.file.name,
			size: item.file.size,
			status: item.status,
			progress: item.progress,
			kind,
			thumbnail:
				kind === "image" && item.result?.url
					? item.result.thumbnail ||
						imageUrl(item.result.url, { thumb: "300x300", format: "webp" })
					: previews.current.get(item.id),
			error: item.error,
			retryAt: item.retryAt,
			cancelling: item.cancelling,
			description:
				item.status === "queued" &&
				policy.isError &&
				policy.data &&
				!queue.requiresManualResume
					? "排队中"
					: undefined,
		};
	});
	const queuePolicy = queue.requiresManualResume
		? "paused"
		: policy.isPending
			? "loading"
			: policy.isError
				? "error"
				: "ready";
	const policyMessage = queue.requiresManualResume
		? "服务端未给出有效恢复时间，队列暂停。"
		: policy.isError
			? policy.data
				? "上传配置刷新失败，继续使用上次配置。"
				: "无法读取上传配置，队列已暂停。"
			: undefined;

	return (
		<div className={className}>
			<input {...inputProps} className="hidden" aria-label="选择上传文件" />
			<div className={entry === "button" ? "flex flex-wrap items-center gap-2" : "space-y-2"}>
				{entry === "button" ? (
					<Button size="sm" disabled={selectionDisabled} onClick={open}>
						<Upload className="size-3.5" aria-hidden="true" />
						{label ?? "上传文件"}
					</Button>
				) : (
					<UploadDropzone
						disabled={selectionDisabled}
						dragActive={isDragActive}
						hint={hint}
						onClick={open}
						onDragOver={(event) => {
							if (!Array.from(event.dataTransfer.types).includes("Files")) return;
							event.preventDefault();
							if (!selectionDisabled) setIsDragActive(true);
						}}
						onDragLeave={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
								setIsDragActive(false);
							}
						}}
						onDrop={(event) => {
							event.preventDefault();
							setIsDragActive(false);
							selectFiles(event.dataTransfer.files);
						}}
					>
						{isDragActive ? "松开即可上传" : (label ?? "拖拽或点击上传")}
					</UploadDropzone>
				)}
				{queue.requiresManualResume && policy.isError && (
					<Button variant="ghost" size="sm" onClick={() => void policy.refetch()}>
						重试配置
					</Button>
				)}
				{pendingCount > 0 && (
					<Button variant="ghost" size="sm" onClick={flushUploaded}>
						展示已上传（{pendingCount}）
					</Button>
				)}
			</div>
			{entry === "button" && isDragActive && (
				<div
					className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-2xl bg-sheet/95 p-6"
					role="status"
				>
					<div className="flex flex-col items-center gap-2 text-center">
						<Upload className="size-5 text-primary" aria-hidden="true" />
						<p>松开即可上传</p>
						{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
					</div>
				</div>
			)}
			{entries.length > 0 && (
				<UploadQueue
					items={entries}
					floating
					concurrency={policy.data?.max_concurrent_files}
					now={now}
					policy={queuePolicy}
					policyMessage={policyMessage}
					onRetryPolicy={() => void policy.refetch()}
					onResume={() => queue.resume()}
					onCancel={(id) => queue.cancel(id)}
					onRetry={(id) => queue.retry(id)}
					onRemove={(id) => queue.remove(id)}
					onCancelAll={cancelAll}
					onClearCompleted={clearCompleted}
					onClose={close}
				/>
			)}
		</div>
	);
}
