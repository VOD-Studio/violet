/**
 * 富内容计算的优先级与取消约束。
 *
 * @remarks 共享计算队列仅接收资源已准备好的任务；需要等待下载的串行流程应使用独立实例。
 */
export interface EnhancementOptions {
	/** 执行前按宿主当前位置判定优先级；缺省时按普通任务排队。 */
	element?: Element | null;
	/** 取消排队或拒绝调用方等待；已启动的计算仍须结束，不能强行中断其副作用。 */
	signal?: AbortSignal;
}

interface PendingEnhancement {
	element?: Element | null;
	run: () => Promise<void>;
}

/**
 * 创建互不阻塞的串行增强队列，复用可见优先、取消与失败隔离规则。
 *
 * @returns 调度函数；每项开始前重新选择可见宿主，已启动的异步任务结束后才释放本队列。
 * @remarks 任务不得等待同一实例中的新任务；独立实例可等待异步资源而不占用共享计算队列。
 */
export function createEnhancementScheduler() {
	const pending: PendingEnhancement[] = [];
	let scheduled = false;

	function scheduleNext() {
		if (scheduled || pending.length === 0) return;
		scheduled = true;
		// 每项单独占用一个事件循环任务，让输入和绘制有机会在相邻计算之间执行。
		setTimeout(async () => {
			if (pending.length === 0) {
				scheduled = false;
				return;
			}
			const height = window.innerHeight;
			const visible = pending.findIndex(({ element }) => {
				if (!element) return false;
				const bounds = element.getBoundingClientRect();
				return bounds.bottom >= 0 && bounds.top <= height;
			});
			const [job] = pending.splice(visible < 0 ? 0 : visible, 1);
			try {
				await job.run();
			} finally {
				scheduled = false;
				scheduleNext();
			}
		}, 0);
	}

	return function schedule<T>(
		work: () => T | Promise<T>,
		{ element, signal }: EnhancementOptions = {},
	): Promise<T> {
		const { promise, resolve, reject } = Promise.withResolvers<T>();
		if (signal?.aborted) {
			reject(signal.reason);
			return promise;
		}
		const abort = () => {
			const index = pending.indexOf(job);
			if (index >= 0) pending.splice(index, 1);
			reject(signal?.reason);
		};
		const job: PendingEnhancement = {
			element,
			run: async () => {
				try {
					signal?.throwIfAborted();
					resolve(await work());
				} catch (error) {
					reject(error);
				} finally {
					signal?.removeEventListener("abort", abort);
				}
			},
		};
		signal?.addEventListener("abort", abort, { once: true });
		pending.push(job);
		scheduleNext();
		return promise;
	};
}

const defaultScheduler = createEnhancementScheduler();

/**
 * 串行执行富内容计算，在每项开始前优先选择视口内的宿主。
 *
 * @typeParam T - 当前计算的结果类型。
 * @param work - 已完成资源准备的计算；不得在其中等待同一队列的新任务。
 * @param options - 宿主与取消信号；不传宿主时仍保证任务间让出主线程。
 * @returns 当前计算结果；失败或取消仅拒绝此 Promise，不阻塞后续任务。
 * @remarks 结果缓存由消费方持有。已开始的异步计算不会因取消而与下一项交叉执行。
 */
export function scheduleEnhancement<T>(
	work: () => T | Promise<T>,
	options?: EnhancementOptions,
): Promise<T> {
	return defaultScheduler(work, options);
}
