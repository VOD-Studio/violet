import { useUploadQueuePolicy } from "@entities/runtime-policy/api/queries";
import { UploadQueue } from "@features/upload/lib/upload-queue";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

/** 将队列连接到运行策略、离页确认和组件生命周期。 */
export function useUploadQueue<T>(onBusyChange?: (busy: boolean) => void) {
	const [queue] = useState(() => new UploadQueue<T>());
	const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
	const policy = useUploadQueuePolicy();
	const busy = items.some((item) => !["done", "cancelled"].includes(item.status));
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		queue.setConcurrency(policy.data?.max_concurrent_files ?? 0);
	}, [queue, policy.data?.max_concurrent_files]);
	useEffect(() => {
		queue.activate();
		return () => queue.dispose();
	}, [queue]);
	useEffect(() => {
		onBusyChange?.(busy);
		return () => onBusyChange?.(false);
	}, [busy, onBusyChange]);
	useEffect(() => {
		if (!items.some((item) => item.retryAt !== undefined && item.retryAt > Date.now())) return;
		const timer = setInterval(() => {
			const current = Date.now();
			setNow(current);
			if (items.every((item) => (item.retryAt ?? 0) <= current)) clearInterval(timer);
		}, 1000);
		return () => clearInterval(timer);
	}, [items]);
	useBlocker({
		disabled: !busy,
		enableBeforeUnload: busy,
		shouldBlockFn: () =>
			!window.confirm("仍有文件排队或上传。离开将取消未完成的上传，是否离开？"),
	});
	return { queue, items, busy, now, policy };
}
