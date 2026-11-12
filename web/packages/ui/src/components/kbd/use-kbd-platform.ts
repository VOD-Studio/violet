import { useSyncExternalStore } from "react";
import type { KbdPlatform } from "./keys";

const MAC_PATTERN = /mac|iphone|ipad|ipod/i;

interface NavigatorWithPlatformHint extends Navigator {
	userAgentData?: { platform?: string };
}

function subscribe() {
	return () => {};
}

function getClientPlatform(): KbdPlatform {
	const hint = (navigator as NavigatorWithPlatformHint).userAgentData?.platform;
	const platform = hint || navigator.platform;
	return MAC_PATTERN.test(platform) ? "mac" : "other";
}

/**
 * 访客所在平台。服务端与水合首帧固定为 `other`，水合完成后才切到真实平台，
 * 因此两次输出一致，不产生水合差异。
 */
export function useKbdPlatform(): KbdPlatform {
	return useSyncExternalStore(subscribe, getClientPlatform, () => "other");
}
