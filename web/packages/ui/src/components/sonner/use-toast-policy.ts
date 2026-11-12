import { useEffect, useRef } from "react";
import { type ToastT, toast, useSonner } from "sonner";

/** 同一个通知区最多同时保留的条数；超出时最早的一条直接移除。 */
export const MAX_TOASTS = 6;

/** 警告的自动关闭时长。 */
export const WARNING_DURATION = 6000;
/** 带操作的通知留给人点击的时长。 */
export const ACTION_DURATION = 8000;

type Duration = number | undefined;

/**
 * 按类型给出自动关闭时长：出错不自动关、带操作 8 秒、警告 6 秒。
 * `undefined` 表示沿用通知区默认值（成功、信息与普通通知 4 秒）；加载中由 sonner 自身不计时。
 */
export function policyDuration(item: Pick<ToastT, "type" | "action">): Duration {
	if (item.type === "error") return Number.POSITIVE_INFINITY;
	if (item.action) return ACTION_DURATION;
	if (item.type === "warning") return WARNING_DURATION;
	return undefined;
}

/** 以同 id 更新的方式写入时长，标题、说明、操作与类型都沿用原样。 */
function applyDuration(item: ToastT, duration: Duration) {
	const data = { id: item.id, duration, dismissible: item.dismissible };
	switch (item.type) {
		case "success":
			toast.success(item.title, data);
			break;
		case "error":
			toast.error(item.title, data);
			break;
		case "warning":
			toast.warning(item.title, data);
			break;
		case "info":
			toast.info(item.title, data);
			break;
		default:
			toast.message(item.title, data);
	}
}

/**
 * 通知区的两条站点级策略：按类型决定自动关闭时长，同时最多保留 {@link MAX_TOASTS} 条。
 *
 * @remarks sonner 只有一个全局默认时长，所以这里观察本通知区的通知，对没有显式 `duration`
 * 的通知补写时长；显式时长（包括更新同一条通知时的新值）永远优先。写入走 sonner 自己的
 * 同 id 更新，不改变位置、高度与动画，只重置计时。已被关闭的通知不会被更新复活。
 *
 * @param toasterId - 通知区的 `id`；省略表示接收所有不带 `toasterId` 的通知
 */
export function useToastPolicy(toasterId: string | undefined) {
	const { toasts } = useSonner();
	/** 记录本策略写入过的时长，用来区分「调用方显式给的」与「我们补的」。 */
	const applied = useRef(new Map<ToastT["id"], Duration>());

	useEffect(() => {
		const mine = toasts.filter((item) =>
			toasterId ? item.toasterId === toasterId : !item.toasterId,
		);
		const remembered = applied.current;
		const live = new Set(mine.map((item) => item.id));
		for (const id of remembered.keys()) if (!live.has(id)) remembered.delete(id);

		const active = new Set(toast.getToasts().map((item) => item.id));
		// 新的在前，超出上限的是最早的几条；它们排在第 4 层之后，本就不可见
		for (const item of mine.slice(MAX_TOASTS)) if (active.has(item.id)) toast.dismiss(item.id);

		for (const item of mine.slice(0, MAX_TOASTS)) {
			if (item.type === "loading" || item.jsx || !active.has(item.id)) continue;
			const ours = item.duration === undefined || remembered.get(item.id) === item.duration;
			const wanted = policyDuration(item);
			if (!ours || item.duration === wanted) continue;
			remembered.set(item.id, wanted);
			applyDuration(item, wanted);
		}
	}, [toasts, toasterId]);
}
