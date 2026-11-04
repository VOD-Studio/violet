import { useMutation, useQuery } from "@tanstack/react-query";
import { getWindow, knockWindow } from "./client";
import { windowKeys } from "./keys";

/**
 * 站长那边的窗状态。
 *
 * @remarks 后端按 15 分钟缓存天气，这里每 10 分钟轮询一次；失败不重试，窗按默认景画。
 */
export const useWindowState = () =>
	useQuery({
		queryKey: windowKeys.state(),
		queryFn: getWindow,
		staleTime: 5 * 60_000,
		refetchInterval: 10 * 60_000,
		retry: false,
	});

/**
 * 敲窗，给站长发一条轻提示。
 *
 * @remarks 同一访客每小时只通知一次，超出返回 429；访客这边照常显示卡片，所以失败静默。
 */
export const useKnockWindow = () => useMutation({ mutationFn: knockWindow });
