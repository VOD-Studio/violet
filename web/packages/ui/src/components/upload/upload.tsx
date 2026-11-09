import { cn } from "cn";
import {
	Check,
	ChevronDown,
	FileText,
	Film,
	Image,
	Music,
	RotateCcw,
	Upload,
	X,
} from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { FlowerBloom, Spinner } from "../indicator";

/** 上传适配器报告的真实文件状态；百分比不代表服务端已经提交。 */
export type UploadEntryStatus = "queued" | "uploading" | "waiting" | "done" | "error" | "cancelled";

/** 上传面板的展示数据，不包含 File、请求或站点业务对象。 */
export interface UploadEntry {
	id: string;
	name: string;
	size: number;
	status: UploadEntryStatus;
	/** 文件级百分比，范围 0–100。 */
	progress: number;
	thumbnail?: string;
	kind?: "image" | "video" | "audio" | "file";
	error?: string;
	/** 可重试的 Unix 时间戳，单位毫秒。 */
	retryAt?: number;
	/** 仍在等待服务端确认取消，不能提前显示已取消。 */
	cancelling?: boolean;
	description?: string;
}

/** 展示受控上传队列；选择文件、策略与取消确认均由宿主处理。 */
export interface UploadQueueProps
	extends Omit<ComponentProps<"section">, "children" | "onCancel" | "onClose"> {
	items: readonly UploadEntry[];
	concurrency?: number;
	/** 毫秒时钟；省略时仅在存在重试倒计时时启动本地时钟。 */
	now?: number;
	policy?: "ready" | "loading" | "error" | "paused";
	policyMessage?: string;
	floating?: boolean;
	defaultCollapsed?: boolean;
	onRetryPolicy?: () => void;
	onResume?: () => void;
	onCancel?: (id: string) => void;
	onRetry?: (id: string) => void;
	onRemove?: (id: string) => void;
	onCancelAll?: () => void;
	onClearCompleted?: () => void;
	/** 宿主先确认未完成项，再等待取消结果后关闭；收起不会调用此回调。 */
	onClose?: () => void;
}

/** 原生文件选择入口；拖放事件、文件与选择器由宿主提供。 */
export interface UploadDropzoneProps extends ComponentProps<"button"> {
	dragActive?: boolean;
	hint?: ReactNode;
}

function fraction(item: UploadEntry) {
	return item.status === "done" ? 1 : Math.min(100, Math.max(0, item.progress)) / 100;
}

function sizeLabel(size: number) {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function entryMessage(item: UploadEntry, remaining: number, policy: UploadQueueProps["policy"]) {
	if (item.cancelling) return "正在确认取消…";
	switch (item.status) {
		case "queued":
			return (
				item.description ??
				(policy === "loading"
					? "等待上传配置"
					: policy === "paused" || policy === "error"
						? "队列已暂停"
						: "排队中")
			);
		case "uploading":
			return (
				item.description ??
				`上传中 ${Math.floor(fraction(item) * 100)}% · ${sizeLabel(Math.round(item.size * fraction(item)))} / ${sizeLabel(item.size)}`
			);
		case "waiting":
			return (
				item.description ?? (remaining > 0 ? `${remaining} 秒后自动继续` : "等待继续上传")
			);
		case "done":
			return item.description ?? "已上传";
		case "error":
			return `${item.error ?? item.description ?? "上传失败"} · 已传 ${Math.floor(fraction(item) * 100)}%${remaining > 0 ? ` · ${remaining} 秒后可重试` : ""}`;
		case "cancelled":
			return item.description ?? "已取消";
	}
}

/** 360px 上传面板；只拥有收起状态与可选的重试倒计时时钟。 */
export function UploadQueue({
	items,
	concurrency,
	now,
	policy = "ready",
	policyMessage,
	floating = false,
	defaultCollapsed = false,
	onRetryPolicy,
	onResume,
	onCancel,
	onRetry,
	onRemove,
	onCancelAll,
	onClearCompleted,
	onClose,
	className,
	ref,
	...props
}: UploadQueueProps) {
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const [clock, setClock] = useState<number>();
	const bodyId = useId();
	const titleId = useId();
	const toggleRef = useRef<HTMLButtonElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const time = now ?? clock;
	const needsClock =
		now === undefined &&
		items.some(
			(item) =>
				(item.status === "waiting" || item.status === "error") &&
				item.retryAt !== undefined &&
				(time === undefined || (item.retryAt ?? 0) > time),
		);
	useEffect(() => {
		if (!needsClock) return;
		setClock(Date.now());
		const timer = setInterval(() => setClock(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [needsClock]);

	const counts = { queued: 0, uploading: 0, waiting: 0, done: 0, error: 0, cancelled: 0 };
	let bytes = 0;
	let transferred = 0;
	let cancelling = false;
	for (const item of items) {
		counts[item.status]++;
		cancelling ||= Boolean(item.cancelling);
		if (item.status !== "cancelled") {
			bytes += item.size;
			transferred += item.size * fraction(item);
		}
	}
	const active = counts.queued + counts.uploading + counts.waiting;
	const unfinished = active + counts.error;
	const progress = bytes > 0 ? Math.floor((transferred / bytes) * 100) : 0;
	const state: UploadEntryStatus = counts.uploading
		? "uploading"
		: counts.waiting
			? "waiting"
			: counts.queued
				? "queued"
				: counts.error
					? "error"
					: counts.done
						? "done"
						: counts.cancelled
							? "cancelled"
							: "queued";
	const title = active
		? `正在上传 ${counts.done} / ${items.length - counts.cancelled}`
		: counts.error
			? `${counts.error} 个文件上传失败`
			: counts.done
				? `已上传 ${counts.done} 个文件`
				: counts.cancelled
					? "上传已取消"
					: "没有在上传的文件";
	const summary = [
		counts.uploading ? `${counts.uploading} 个上传中` : "",
		counts.queued ? `${counts.queued} 个排队` : "",
		counts.waiting ? `${counts.waiting} 个等待` : "",
		counts.error ? `${counts.error} 个出错` : "",
		counts.done ? `${counts.done} 个已完成` : "",
		counts.cancelled ? `${counts.cancelled} 个已取消` : "",
		concurrency !== undefined ? `同时最多 ${concurrency} 个` : "",
	]
		.filter(Boolean)
		.join(" · ");

	function remove(item: UploadEntry, button: HTMLButtonElement) {
		const row = button.closest("li");
		const next =
			row?.nextElementSibling?.querySelector<HTMLButtonElement>("button:not(:disabled)") ??
			row?.previousElementSibling?.querySelector<HTMLButtonElement>("button:not(:disabled)");
		(next ?? toggleRef.current)?.focus({ preventScroll: true });
		onRemove?.(item.id);
	}

	return (
		<section
			{...props}
			ref={ref}
			aria-labelledby={
				props["aria-label"] ? undefined : (props["aria-labelledby"] ?? titleId)
			}
			className={cn("v-upload-queue", className)}
			data-state={state}
			data-policy={policy}
			data-floating={floating || undefined}
			data-collapsed={collapsed}
			data-cancelling={cancelling || undefined}
		>
			<header className="v-upload-queue__header">
				<svg
					className="v-upload-queue__ring"
					viewBox="0 0 32 32"
					role="progressbar"
					aria-label="上传总进度（按文件大小加权）"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progress}
				>
					<circle className="v-upload-queue__ring-track" cx="16" cy="16" r="12" />
					<circle
						className="v-upload-queue__ring-value"
						cx="16"
						cy="16"
						r="12"
						pathLength="100"
						strokeDasharray={`${progress} 100`}
					/>
				</svg>
				<div className="v-upload-queue__heading">
					<strong id={titleId} role="status">
						{title}
					</strong>
					<span title={summary}>{summary}</span>
				</div>
				<button
					type="button"
					ref={toggleRef}
					className="v-upload-queue__action v-upload-queue__toggle"
					aria-label={collapsed ? "展开上传面板" : "收起上传面板"}
					aria-expanded={!collapsed}
					aria-controls={bodyId}
					onClick={(event) => {
						if (event.defaultPrevented) return;
						event.currentTarget.focus({ preventScroll: true });
						setCollapsed(!collapsed);
					}}
				>
					<ChevronDown aria-hidden="true" />
				</button>
				{onClose && (
					<button
						type="button"
						className="v-upload-queue__action"
						aria-label="关闭上传面板"
						onClick={(event) => {
							if (!event.defaultPrevented) onClose();
						}}
					>
						<X aria-hidden="true" />
					</button>
				)}
			</header>
			<div
				id={bodyId}
				className="v-upload-queue__body"
				inert={collapsed}
				aria-hidden={collapsed || undefined}
			>
				<div className="v-upload-queue__crop">
					<div className="v-upload-queue__content">
						{policy !== "ready" && (
							<div
								className="v-upload-queue__policy"
								role={policy === "error" ? "alert" : "status"}
							>
								{policy === "loading" && <Spinner aria-hidden="true" />}
								<span>
									{policyMessage ??
										(policy === "loading"
											? "正在读取上传配置…"
											: policy === "error"
												? "上传配置读取失败，队列已暂停"
												: "上传已暂停")}
								</span>
								{policy === "error" && onRetryPolicy && (
									<button
										type="button"
										className="v-upload-queue__action v-upload-queue__text-action"
										onClick={(event) => {
											if (!event.defaultPrevented) onRetryPolicy();
										}}
									>
										重试配置
									</button>
								)}
								{policy === "paused" && onResume && (
									<button
										type="button"
										className="v-upload-queue__action v-upload-queue__text-action"
										onClick={(event) => {
											if (!event.defaultPrevented) onResume();
										}}
									>
										继续上传
									</button>
								)}
							</div>
						)}
						<ul
							ref={listRef}
							className="v-upload-queue__list"
							aria-label="上传文件"
							onFocusCapture={(event) => {
								const list = listRef.current;
								if (!list) return;
								const row = event.target.closest("li");
								if (!row) return;
								const bounds = row.getBoundingClientRect();
								const viewport = list.getBoundingClientRect();
								if (bounds.top < viewport.top + 4)
									list.scrollTop -= viewport.top + 4 - bounds.top;
								else if (bounds.bottom > viewport.bottom - 4)
									list.scrollTop += bounds.bottom - viewport.bottom + 4;
							}}
						>
							{items.map((item) => {
								const remaining =
									time === undefined
										? 0
										: Math.max(
												0,
												Math.ceil(((item.retryAt ?? 0) - time) / 1000),
											);
								const message = entryMessage(item, remaining, policy);
								const split = item.name.lastIndexOf(".");
								const extension = split > 0 ? item.name.slice(split) : "";
								const Icon =
									item.kind === "image"
										? Image
										: item.kind === "video"
											? Film
											: item.kind === "audio"
												? Music
												: FileText;
								return (
									<li
										key={item.id}
										className="v-upload-queue__row"
										data-state={item.status}
										data-cancelling={item.cancelling || undefined}
									>
										<span
											className="v-upload-queue__thumbnail"
											aria-hidden="true"
										>
											{item.thumbnail ? (
												<img src={item.thumbnail} alt="" />
											) : (
												<Icon />
											)}
										</span>
										<div className="v-upload-queue__main">
											<div className="v-upload-queue__file">
												<span
													className="v-upload-queue__name"
													title={item.name}
												>
													<span>
														{extension
															? item.name.slice(0, split)
															: item.name}
													</span>
													{extension && (
														<span className="v-upload-queue__extension">
															{extension}
														</span>
													)}
												</span>
												<span className="v-upload-queue__size">
													{sizeLabel(item.size)}
												</span>
											</div>
											<div
												className="v-upload-queue__status"
												role={
													item.status === "error" && !item.cancelling
														? "alert"
														: "status"
												}
												title={message}
											>
												{item.cancelling ? (
													<Spinner aria-hidden="true" />
												) : item.status === "queued" ||
													item.status === "waiting" ? (
													<FlowerBloom
														kind="branch"
														size={16}
														variant="outline"
														tone="season"
														aria-hidden="true"
													/>
												) : item.status === "done" ? (
													<Check aria-hidden="true" />
												) : null}
												<span>{message}</span>
											</div>
											<div
												className="v-upload-queue__progress"
												aria-hidden="true"
												style={{ transform: `scaleX(${fraction(item)})` }}
											/>
										</div>
										<div className="v-upload-queue__actions">
											{item.status === "error" && onRetry && (
												<button
													type="button"
													className="v-upload-queue__action"
													aria-label={`重试 ${item.name}${remaining ? `（${remaining} 秒后可重试）` : ""}`}
													disabled={
														(time === undefined &&
															item.retryAt !== undefined) ||
														remaining > 0 ||
														item.cancelling
													}
													onClick={(event) => {
														if (!event.defaultPrevented)
															onRetry(item.id);
													}}
												>
													<RotateCcw aria-hidden="true" />
												</button>
											)}
											{item.status !== "done" &&
												item.status !== "cancelled" &&
												onCancel && (
													<button
														type="button"
														className="v-upload-queue__action"
														aria-label={`取消 ${item.name}`}
														disabled={item.cancelling}
														onClick={(event) => {
															if (!event.defaultPrevented)
																onCancel(item.id);
														}}
													>
														<X aria-hidden="true" />
													</button>
												)}
											{(item.status === "done" ||
												item.status === "cancelled") &&
												!item.cancelling &&
												onRemove && (
													<button
														type="button"
														className="v-upload-queue__action v-upload-queue__remove"
														aria-label={`移除 ${item.name}`}
														onClick={(event) => {
															if (!event.defaultPrevented)
																remove(item, event.currentTarget);
														}}
													>
														<X aria-hidden="true" />
													</button>
												)}
										</div>
									</li>
								);
							})}
						</ul>
						{items.length === 0 && (
							<p className="v-upload-queue__empty" role="status">
								还没有选择文件
							</p>
						)}
						{((unfinished > 0 && onCancelAll) ||
							(counts.done + counts.cancelled > 0 && onClearCompleted)) && (
							<footer className="v-upload-queue__footer">
								{unfinished > 0 && onCancelAll && (
									<button
										type="button"
										className="v-upload-queue__action v-upload-queue__text-action"
										disabled={cancelling}
										onClick={(event) => {
											if (!event.defaultPrevented) onCancelAll();
										}}
									>
										取消未完成
									</button>
								)}
								{counts.done + counts.cancelled > 0 && onClearCompleted && (
									<button
										type="button"
										className="v-upload-queue__action v-upload-queue__text-action"
										onClick={(event) => {
											if (event.defaultPrevented) return;
											toggleRef.current?.focus({ preventScroll: true });
											onClearCompleted();
										}}
									>
										清除已结束
									</button>
								)}
							</footer>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

/** 有文字与提示的原生选择按钮，不读文件、不接管拖放或网络。 */
export function UploadDropzone({
	dragActive = false,
	hint,
	children,
	className,
	type = "button",
	ref,
	...props
}: UploadDropzoneProps) {
	return (
		<button
			{...props}
			ref={ref}
			type={type}
			className={cn("v-upload-dropzone", className)}
			data-drag-active={dragActive || undefined}
		>
			<Upload className="v-upload-dropzone__icon" aria-hidden="true" />
			<span className="v-upload-dropzone__label">{children}</span>
			{hint && <span className="v-upload-dropzone__hint">{hint}</span>}
		</button>
	);
}
