import { ApiError } from "@shared/api/error";

/** 文件队列的可见状态。 */
export type UploadQueueStatus = "queued" | "uploading" | "waiting" | "done" | "error" | "cancelled";

/** 一项上传在各批次之间保留的状态。 */
export interface UploadQueueItem<T> {
	id: string;
	file: File;
	status: UploadQueueStatus;
	/** 文件级百分比，范围 0–100；不用于推断服务端是否已经提交。 */
	progress: number;
	result?: T;
	error?: string;
	/** 服务端恢复时刻换算后的本地 Unix 毫秒时间，等待期间不可提前重试。 */
	retryAt?: number;
	/** 已请求取消但尚未确认；确认失败时保留错误并重试取消，不重新上传。 */
	cancelling?: boolean;
}

/** 单文件执行器须透传取消信号，合并已完成时返回真实成功结果。 */
export type UploadExecutor<T> = (
	file: File,
	progress: (percent: number) => void,
	signal: AbortSignal,
) => Promise<T>;

interface QueueTask<T> {
	run: UploadExecutor<T>;
	onUploaded: (result: T, file: File) => void;
	controller?: AbortController;
	started?: boolean;
	cancelRequested?: boolean;
}

/**
 * 跨选择批次调度，只在服务端给出的有效恢复时刻后继续上传。
 */
export class UploadQueue<T> {
	private items: UploadQueueItem<T>[] = [];
	private readonly tasks = new Map<string, QueueTask<T>>();
	private readonly listeners = new Set<() => void>();
	private limit = 0;
	private blockedUntil = 0;
	private paused = false;
	private timer?: ReturnType<typeof setTimeout>;
	private disposed = false;

	get requiresManualResume() {
		return this.paused;
	}

	resume() {
		this.paused = false;
		this.schedule();
		this.items = [...this.items];
		this.emit();
	}

	readonly subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	readonly getSnapshot = () => this.items;

	/**
	 * 更新后续调度的文件并发，不中断已启动任务。
	 *
	 * @param limit - 有效范围 1–10；无有效配置时传 0 暂停新任务。
	 */
	setConcurrency(limit: number) {
		this.limit = Number.isInteger(limit) && limit >= 1 && limit <= 10 ? limit : 0;
		this.schedule();
	}

	add(files: File[], run: UploadExecutor<T>, onUploaded: (result: T, file: File) => void) {
		for (const file of files) {
			const id = crypto.randomUUID();
			this.tasks.set(id, { run, onUploaded });
			this.items = [...this.items, { id, file, status: "queued", progress: 0 }];
		}
		this.emit();
		this.schedule();
	}

	/** 上传失败重试原任务；取消失败只重试确认取消。 */
	retry(id: string) {
		const item = this.items.find((entry) => entry.id === id);
		const task = this.tasks.get(id);
		if (!item || !task || item.status !== "error" || (item.retryAt ?? 0) > Date.now()) return;
		if (task.cancelRequested) {
			this.cancel(id);
			return;
		}
		this.paused = false;
		this.update(id, {
			status: "queued",
			error: undefined,
			retryAt: undefined,
			cancelling: false,
		});
		this.schedule();
	}

	/** 排队项立即取消；已启动项等待执行器确认取消或返回先完成的结果。 */
	cancel(id: string) {
		const task = this.tasks.get(id);
		const item = this.items.find((entry) => entry.id === id);
		if (!task || !item || item.status === "done" || item.status === "cancelled") return;
		task.cancelRequested = true;
		if (task.controller) {
			this.update(id, { cancelling: true });
			task.controller.abort();
		} else if (task.started) {
			void this.execute(item, task, true);
		} else {
			this.update(id, { status: "cancelled", retryAt: undefined });
		}
		this.schedule();
	}

	remove(id: string) {
		const item = this.items.find((entry) => entry.id === id);
		if (!item || !["done", "cancelled"].includes(item.status)) return;
		this.items = this.items.filter((entry) => entry.id !== id);
		this.tasks.delete(id);
		this.emit();
	}

	dispose() {
		this.disposed = true;
		clearTimeout(this.timer);
		for (const item of this.items) {
			if (!["done", "cancelled"].includes(item.status)) this.cancel(item.id);
		}
	}

	activate() {
		this.disposed = false;
		this.schedule();
	}

	private emit() {
		for (const listener of this.listeners) listener();
	}

	private update(id: string, patch: Partial<UploadQueueItem<T>>) {
		this.items = this.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
		this.emit();
	}

	private schedule() {
		clearTimeout(this.timer);
		if (this.disposed || this.paused || this.limit === 0) return;
		if (!this.items.some((item) => item.status === "queued" || item.status === "waiting"))
			return;
		const now = Date.now();
		if (this.blockedUntil > now) {
			this.timer = setTimeout(
				() => this.schedule(),
				Math.min(this.blockedUntil - now, 2_147_483_647),
			);
			return;
		}
		for (const item of this.items) {
			if (item.status === "waiting" && (item.retryAt ?? 0) <= now) {
				this.update(item.id, { status: "queued", retryAt: undefined });
			}
		}
		let active = this.items.filter((item) => item.status === "uploading").length;
		for (const item of this.items) {
			if (active >= this.limit) break;
			if (item.status !== "queued") continue;
			const task = this.tasks.get(item.id);
			if (!task || task.controller) continue;
			active++;
			void this.execute(item, task);
		}
	}

	private async execute(item: UploadQueueItem<T>, task: QueueTask<T>, cancel = false) {
		const controller = new AbortController();
		task.controller = controller;
		task.started = true;
		if (cancel) controller.abort();
		this.update(item.id, { status: "uploading", error: undefined, cancelling: cancel });
		try {
			const result = await task.run(
				item.file,
				(progress) => this.update(item.id, { progress }),
				controller.signal,
			);
			this.update(item.id, { status: "done", progress: 100, result, cancelling: false });
			// 已完成上传不可因业务刷新回调异常而再次执行。
			try {
				task.onUploaded(result, item.file);
			} catch (error) {
				console.error("上传成功回调失败", error);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				this.update(item.id, { status: "cancelled", cancelling: false });
			} else if (error instanceof ApiError && error.status === 429) {
				const retryAt = error.retryAt;
				if (retryAt !== undefined) this.blockedUntil = Math.max(this.blockedUntil, retryAt);
				else this.paused = true;
				const canResume =
					!controller.signal.aborted && retryAt !== undefined && retryAt > Date.now();
				this.update(item.id, {
					status: canResume ? "waiting" : "error",
					retryAt,
					cancelling: false,
					error: controller.signal.aborted
						? "取消尚未确认，请重试取消"
						: canResume
							? "请求受限，等待服务端允许恢复"
							: "请求受限，请在允许恢复后手动重试",
				});
			} else {
				this.update(item.id, {
					status: "error",
					cancelling: false,
					error: controller.signal.aborted
						? `取消尚未确认：${error instanceof Error ? error.message : "请重试取消"}`
						: error instanceof Error
							? error.message
							: "上传失败",
				});
			}
		} finally {
			task.controller = undefined;
			queueMicrotask(() => this.schedule());
		}
	}
}
