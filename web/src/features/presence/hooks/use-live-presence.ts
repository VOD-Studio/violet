import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getPresence } from "../api/client";
import { presenceKeys } from "../api/keys";
import { leadDevice, liveDevices, type PresenceReceipt, pausedExpiryTimes } from "../lib/presence";
import type { PresenceDevice } from "../model/types";

export interface LivePresence {
	/** 租约内在线的设备，按服务端顺序 */
	devices: PresenceDevice[];
	/** 顶栏展示的主设备；无人在线时为 null */
	lead: PresenceDevice | null;
	/** 服务端时钟减本机时钟（毫秒），用于推进播放位置 */
	clockOffset: number;
}

const fetchReceipt = async (): Promise<PresenceReceipt> => ({
	presence: await getPresence(),
	receivedAt: Date.now(),
});

/**
 * 读取当前公开的实时状态，并在租约到期时自动隐藏。
 *
 * @remarks 数据由 usePresenceStream 推入缓存；本 hook 不发请求、不建连接，可在任意处多次调用。
 */
export function useLivePresence(): LivePresence {
	const { data: receipt } = useQuery({
		queryKey: presenceKeys.current(),
		queryFn: fetchReceipt,
		enabled: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [now, setNow] = useState(() => Date.now());

	// 推送中断时也要按期隐藏：在最近一次租约到期或暂停超时时重算
	useEffect(() => {
		if (!receipt) return;
		const generatedAt = Date.parse(receipt.presence.generated_at);
		const current = Date.now();
		const expiries = [
			...receipt.presence.devices.map(
				(device) => receipt.receivedAt + (Date.parse(device.expires_at) - generatedAt),
			),
			...pausedExpiryTimes(receipt),
		];
		// now 停在旧值（定时器被冻结、新快照刚到）时，已经过去的到期时刻要立即反映出来
		if (expiries.some((expiry) => expiry > now && expiry <= current)) {
			setNow(current);
			return;
		}
		const upcoming = expiries.filter((expiry) => expiry > current);
		if (upcoming.length === 0) return;
		const timer = window.setTimeout(
			() => setNow(Date.now()),
			Math.min(...upcoming) - current + 50,
		);
		return () => window.clearTimeout(timer);
	}, [receipt, now]);

	return useMemo(() => {
		const devices = liveDevices(receipt, now);
		const clockOffset = receipt
			? Date.parse(receipt.presence.generated_at) - receipt.receivedAt
			: 0;
		return { devices, lead: leadDevice(devices), clockOffset };
	}, [receipt, now]);
}
