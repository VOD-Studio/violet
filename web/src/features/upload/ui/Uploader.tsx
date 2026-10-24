import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { useFileSelection } from "@features/upload/hooks/use-file-selection";
import { useUploadQueue } from "@features/upload/hooks/use-upload-queue";
import { imageUrl } from "@shared/lib/image-url";
import { Button } from "@violet/ui";

import { AlertCircle, FileText, Film, Loader2, Music, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/** 上传结果至少含可访问 url,列表缩略图据此预览;可选 thumbnail 为后端生成的缩略图 */
export interface UploadResult {
	url: string;
	/** 后端生成的缩略图(300px),可选;缺失时列表回退动态裁剪参数 */
	thumbnail?: string;
}

interface UploaderProps<T extends UploadResult> {
	/** 自定义单文件上传；省略时使用默认分片上传。 */
	upload?: (
		file: File,
		onProgress?: (percent: number) => void,
		signal?: AbortSignal,
	) => Promise<T>;
	/** 单文件成功回调，调用方据此落库 */
	onUploaded?: (result: T, file: File) => void;
	/** 父级关闭入口应在存在未完成上传时确认。 */
	onBusyChange?: (busy: boolean) => void;
	/** 仅禁止追加选择，不中断已排队任务。 */
	disabled?: boolean;
	/** 用途分类（仅默认分片上传模式生效），默认 material */
	purpose?: string;
	/** 接受的 MIME 或扩展名，逗号分隔。 */
	accept?: string;
	/** 单文件最大字节 */
	maxSize?: number;
	/** 每次选择的最大文件数。 */
	maxFiles?: number;
	/** 拖拽区主文案 */
	label?: string;
	/** 拖拽区副提示 */
	hint?: string;
	className?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/** 支持点击与拖放上传，展示各文件状态与进度。 */
export function Uploader<T extends UploadResult>({
	upload: customUpload,
	onUploaded,
	purpose = "material",
	onBusyChange,
	disabled = false,
	accept = "image/*",
	maxSize = DEFAULT_MAX_SIZE,
	maxFiles = 20,
	label = "拖拽或点击上传",
	hint,
	className,
}: UploaderProps<T>) {
	const { queue, items, busy, now, policy } = useUploadQueue<T>(onBusyChange);
	const [isDragActive, setIsDragActive] = useState(false);
	// 并发完成时读取最新回调，避免消费者用旧列表覆盖其他文件的结果。
	const uploadedRef = useRef(onUploaded);
	uploadedRef.current = onUploaded;

	const { uploadFile: chunkedUpload } = useChunkedUpload({ purpose });

	const uploadFiles = useCallback(
		(files: File[]) => {
			queue.add(
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
					uploadedRef.current?.(result, file);
					toast.success(`「${file.name}」上传成功`);
				},
			);
		},
		[queue, customUpload, chunkedUpload],
	);
	const { inputProps, open, selectFiles } = useFileSelection({
		accept,
		maxSize,
		maxFiles,
		disabled,
		onSelect: uploadFiles,
	});

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragActive(false);
		selectFiles(e.dataTransfer.files);
	};

	const clearCompleted = () => {
		for (const item of items) if (item.status === "done") queue.remove(item.id);
	};

	const completedCount = items.filter((it) => it.status === "done").length;

	return (
		<div className={`space-y-4 ${className ?? ""}`}>
			<input {...inputProps} className="hidden" />
			<button
				type="button"
				disabled={disabled}
				onDrop={handleDrop}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragActive(true);
				}}
				onDragLeave={() => setIsDragActive(false)}
				onClick={open}
				className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
					isDragActive
						? "border-primary bg-primary/5"
						: "border-muted-foreground/25 hover:border-primary hover:bg-muted/50"
				}`}
			>
				<Upload className="mb-1 size-6 text-muted-foreground" />
				{isDragActive ? (
					<p className="text-sm font-medium text-primary">松开鼠标上传</p>
				) : (
					<div className="text-center">
						<p className="text-sm font-medium">{label}</p>
						{hint ? (
							<p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
						) : null}
					</div>
				)}
			</button>
			{queue.requiresManualResume && (
				<div role="alert" className="flex items-center gap-2 text-sm text-destructive-text">
					<span>服务端未给出有效恢复时间，队列暂停。</span>
					<Button variant="outline" size="sm" onClick={() => queue.resume()}>
						手动恢复队列
					</Button>
				</div>
			)}
			{policy.isPending && (
				<p role="status" className="text-sm text-muted-foreground">
					正在读取上传并发配置，文件将先排队。
				</p>
			)}
			{policy.isError && (
				<div role="alert" className="flex items-center gap-2 text-sm text-destructive-text">
					<span>
						{policy.data
							? "上传配置刷新失败，继续使用上次配置。"
							: "无法读取上传配置，队列已暂停。"}
					</span>
					<Button variant="outline" size="sm" onClick={() => void policy.refetch()}>
						重试配置
					</Button>
				</div>
			)}
			{busy && (
				<div className="flex items-center justify-between gap-2 text-sm">
					<span role="status">
						上传并发 {policy.data?.max_concurrent_files ?? "—"} ·
						关闭或离页将取消未完成项
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							for (const item of items)
								if (!["done", "cancelled"].includes(item.status))
									queue.cancel(item.id);
						}}
					>
						取消全部
					</Button>
				</div>
			)}

			{items.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">
							{completedCount > 0 ? `已完成 ${completedCount} 个` : "等待上传..."}
						</span>
						{completedCount > 0 && (
							<Button variant="ghost" size="sm" onClick={clearCompleted}>
								清空已完成
							</Button>
						)}
					</div>
					<div className="max-h-60 space-y-2 overflow-y-auto">
						{items.map((item) => (
							<div
								key={item.id}
								className="flex max-w-full items-center gap-3 overflow-hidden rounded-lg border p-2"
							>
								<div className="shrink-0">
									{item.status === "done" && item.result ? (
										// 40px 缩略图:优先上传时后端生成的 300px thumb,
										// 缺失回退动态裁剪,不拉原图
										<FileThumb
											url={
												item.result.thumbnail ||
												imageUrl(item.result.url, {
													thumb: "300x300",
													format: "webp",
												})
											}
											name={item.file.name}
											mime={item.file.type}
											className="size-10"
										/>
									) : (
										<div className="flex size-10 items-center justify-center rounded bg-muted">
											{item.status === "uploading" && (
												<Loader2 className="size-4 animate-spin text-primary" />
											)}
											{item.status === "error" && (
												<AlertCircle className="size-4 text-destructive" />
											)}
										</div>
									)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm">{item.file.name}</p>
									<p className="text-xs text-muted-foreground" role="status">
										{item.cancelling
											? "正在确认取消结果…"
											: {
													queued: "排队中",
													uploading: `上传中 ${item.progress}%`,
													waiting: `请求受限，${Math.max(0, Math.ceil(((item.retryAt ?? now) - now) / 1000))} 秒后恢复`,
													done: "上传成功",
													error: "上传失败",
													cancelled: "已取消",
												}[item.status]}
									</p>
									{item.status === "uploading" && (
										<div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full bg-primary transition-all"
												style={{ width: `${item.progress}%` }}
											/>
										</div>
									)}
									{item.status === "error" && (
										<p className="mt-0.5 text-xs text-destructive-text">
											{item.error}
										</p>
									)}
								</div>
								{item.status === "error" && (
									<Button
										variant="outline"
										size="sm"
										disabled={(item.retryAt ?? 0) > now}
										onClick={() => queue.retry(item.id)}
									>
										{(item.retryAt ?? 0) > now
											? `${Math.ceil(((item.retryAt ?? now) - now) / 1000)} 秒后重试`
											: "重试"}
									</Button>
								)}
								{!["done", "cancelled"].includes(item.status) && (
									<Button
										variant="ghost"
										size="sm"
										disabled={item.cancelling}
										onClick={() => queue.cancel(item.id)}
									>
										取消
									</Button>
								)}
								{["done", "cancelled"].includes(item.status) && (
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={`移除${item.file.name}`}
										onClick={() => queue.remove(item.id)}
										className="shrink-0"
									>
										<X className="size-4" />
									</Button>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * FileThumb - 文件缩略图/图标
 *
 * 图片显示缩略图，其他类型显示对应图标。
 */
function FileThumb({
	url,
	name,
	mime,
	className,
}: {
	url: string;
	name: string;
	mime: string;
	className?: string;
}) {
	if (mime.startsWith("image/")) {
		return <img src={url} alt={name} className={`${className ?? ""} rounded object-cover`} />;
	}
	const Icon = mime.startsWith("video/") ? Film : mime.startsWith("audio/") ? Music : FileText;
	return (
		<div
			className={`${className ?? ""} flex items-center justify-center rounded bg-muted text-muted-foreground`}
		>
			<Icon className="size-4" />
		</div>
	);
}
