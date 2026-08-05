import { imageUrl } from "@shared/lib/image-url";
import { Button } from "@shared/ui/base/button";
import { AlertCircle, FileText, Film, Loader2, Music, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useChunkedUpload } from "../hooks/use-chunked-upload";

/** 上传结果至少含可访问 url,列表缩略图据此预览;可选 thumbnail 为后端生成的缩略图 */
export interface UploadResult {
	url: string;
	/** 后端生成的缩略图(300px),可选;缺失时列表回退动态裁剪参数 */
	thumbnail?: string;
}

type ItemStatus = "uploading" | "done" | "error";

interface UploadItem<T> {
	id: string;
	file: File;
	status: ItemStatus;
	progress: number; // 0-100
	result?: T;
	error?: string;
}

interface UploaderProps<T extends UploadResult> {
	/**
	 * 自定义上传单文件函数（后门）。
	 * 传了则用自定义逻辑（如表情/头像专用接口），不传则走默认分片上传（秒传+进度）。
	 */
	upload?: (file: File, onProgress?: (percent: number) => void) => Promise<T>;
	/** 单文件成功回调，调用方据此落库 */
	onUploaded?: (result: T) => void;
	/** 用途分类（仅默认分片上传模式生效），默认 material */
	purpose?: string;
	/** 接受的 MIME，逗号分隔 */
	accept?: string;
	/** 单文件最大字节 */
	maxSize?: number;
	/** 最大文件数 */
	maxFiles?: number;
	/** 拖拽区主文案 */
	label?: string;
	/** 拖拽区副提示 */
	hint?: string;
	className?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/**
 * Uploader - 通用文件上传组件
 *
 * 拖拽与点击多选，支持两种模式：
 * - **默认分片上传**（不传 upload）：SHA-256 秒传 + 断点续传 + 分片进度条，适合大文件/通用素材
 * - **自定义上传**（传 upload）：调用方绑定具体接口（如表情上传），向后兼容
 *
 * 列表展示每项状态与进度，文件类型自动识别图标。
 */
export function Uploader<T extends UploadResult>({
	upload: customUpload,
	onUploaded,
	purpose = "material",
	accept = "image/*",
	maxSize = DEFAULT_MAX_SIZE,
	maxFiles = 20,
	label = "拖拽或点击上传",
	hint,
	className,
}: UploaderProps<T>) {
	const inputRef = useRef<HTMLInputElement>(null);
	const idRef = useRef(0);
	const [items, setItems] = useState<UploadItem<T>[]>([]);
	const [isDragActive, setIsDragActive] = useState(false);

	// 默认分片上传能力（customUpload 存在时不使用）
	const { uploadFile: chunkedUpload } = useChunkedUpload({ purpose });

	const updateItem = useCallback((id: string, updates: Partial<UploadItem<T>>) => {
		setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
	}, []);

	const uploadOne = useCallback(
		(item: UploadItem<T>) => {
			updateItem(item.id, { status: "uploading", progress: 0 });

			const onProgress = (percent: number) => {
				updateItem(item.id, { progress: percent });
			};

			const run = customUpload
				? customUpload(item.file, onProgress)
				: (chunkedUpload(item.file, (p) => onProgress(p.percent)) as unknown as Promise<T>);

			run.then((result) => {
				updateItem(item.id, { status: "done", result, progress: 100 });
				onUploaded?.(result);
				toast.success(`「${item.file.name}」上传成功`);
			}).catch((err: unknown) => {
				updateItem(item.id, {
					status: "error",
					progress: 0,
					error: err instanceof Error ? err.message : "上传失败",
				});
				toast.error("上传失败，请重试");
			});
		},
		[customUpload, chunkedUpload, updateItem, onUploaded],
	);

	const acceptFiles = useCallback(
		(files: FileList | File[]) => {
			const all = Array.from(files);
			const valid = all.filter((f) => f.size <= maxSize);
			if (valid.length < all.length) {
				toast.warning("部分文件超过大小限制，已自动过滤");
			}
			const slice = valid.slice(0, maxFiles);
			const newItems: UploadItem<T>[] = slice.map((file) => ({
				id: `upload-${idRef.current++}`,
				file,
				status: "uploading",
				progress: 0,
			}));
			setItems((prev) => [...prev, ...newItems]);
			for (const it of newItems) uploadOne(it);
		},
		[maxSize, maxFiles, uploadOne],
	);

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragActive(false);
		if (e.dataTransfer.files.length > 0) acceptFiles(e.dataTransfer.files);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) acceptFiles(e.target.files);
		e.target.value = "";
	};

	const removeItem = (id: string) => {
		setItems((prev) => prev.filter((it) => it.id !== id));
	};

	const clearCompleted = () => {
		setItems((prev) => prev.filter((it) => it.status !== "done"));
	};

	const completedCount = items.filter((it) => it.status === "done").length;

	return (
		<div className={`space-y-4 ${className ?? ""}`}>
			<button
				type="button"
				onDrop={handleDrop}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragActive(true);
				}}
				onDragLeave={() => setIsDragActive(false)}
				onClick={() => inputRef.current?.click()}
				className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
					isDragActive
						? "border-primary bg-primary/5"
						: "border-muted-foreground/25 hover:border-primary hover:bg-muted/50"
				}`}
			>
				<input
					ref={inputRef}
					type="file"
					accept={accept}
					multiple
					className="hidden"
					onChange={handleInputChange}
				/>
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
									{item.status === "uploading" && (
										<div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full bg-primary transition-all"
												style={{ width: `${item.progress}%` }}
											/>
										</div>
									)}
									{item.status === "error" && (
										<p className="mt-0.5 text-xs text-destructive">
											{item.error}
										</p>
									)}
								</div>
								<Button
									variant="ghost"
									size="icon-sm"
									onClick={() => removeItem(item.id)}
									className="shrink-0"
								>
									<X className="size-4" />
								</Button>
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
