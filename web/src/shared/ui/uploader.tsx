import { Button } from "@shared/ui/button";
import { AlertCircle, Loader2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/** 上传结果至少含可访问 url，列表缩略图据此预览 */
export interface UploadResult {
	url: string;
}

type ItemStatus = "uploading" | "done" | "error";

interface UploadItem<T> {
	id: string;
	file: File;
	status: ItemStatus;
	result?: T;
	error?: string;
}

interface UploaderProps<T extends UploadResult> {
	/** 上传单文件，由调用方绑定具体接口 */
	upload: (file: File) => Promise<T>;
	/** 单文件成功回调，调用方据此落库 */
	onUploaded?: (result: T) => void;
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
 * 拖拽与点击多选，逐个调用调用方注入的 upload 函数，列表展示每项状态。
 * 不绑定具体上传接口，由调用方传入 upload 与 onUploaded 处理业务落库。
 */
export function Uploader<T extends UploadResult>({
	upload,
	onUploaded,
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

	const updateItem = useCallback((id: string, updates: Partial<UploadItem<T>>) => {
		setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
	}, []);

	const uploadOne = useCallback(
		(item: UploadItem<T>) => {
			updateItem(item.id, { status: "uploading" });
			upload(item.file)
				.then((result) => {
					updateItem(item.id, { status: "done", result });
					onUploaded?.(result);
					toast.success(`「${item.file.name}」上传成功`);
				})
				.catch((err: unknown) => {
					updateItem(item.id, {
						status: "error",
						error: err instanceof Error ? err.message : "上传失败",
					});
					toast.error("上传失败，请重试");
				});
		},
		[upload, updateItem, onUploaded],
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
			<div
				onDrop={handleDrop}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragActive(true);
				}}
				onDragLeave={() => setIsDragActive(false)}
				onClick={() => inputRef.current?.click()}
				className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
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
			</div>

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
					<div className="max-h-[200px] space-y-2 overflow-y-auto">
						{items.map((item) => (
							<div
								key={item.id}
								className="flex items-center gap-3 rounded-lg border p-2"
							>
								<div className="shrink-0">
									{item.status === "done" && item.result ? (
										<img
											src={item.result.url}
											alt={item.file.name}
											className="size-10 rounded object-cover"
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
									{item.status === "error" && (
										<p className="mt-0.5 text-xs text-destructive">{item.error}</p>
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
