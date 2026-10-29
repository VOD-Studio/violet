import {
	DECORATION_LAYERS,
	type DecorationLayer,
	type DecorationLayers,
	type DecorationPreference,
	getClientDecorationLayers,
	persistDecorationLayers,
	persistDecorationPreference,
	resolveDecoration,
	serializeDecorationLayers,
} from "@shared/lib/decoration-preference";
import type { Season } from "@shared/lib/theme-preference";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";

interface DecorationSwitcher {
	preference: DecorationPreference;
	season: Season | null;
	layers: DecorationLayers;
	switchDecoration: (preference: DecorationPreference) => Promise<void>;
	setLayer: (layer: DecorationLayer, enabled: boolean) => Promise<void>;
}

// Cookie Store 写入是异步的；所有入口共用写入队列，防止旧写入最后落盘。
let pendingWrite: Promise<void> = Promise.resolve();
let latestUpdate: Promise<void> = Promise.resolve();
let writeVersion = 0;

function persistInOrder(
	write: () => Promise<void>,
	invalidate: () => Promise<void>,
): Promise<void> {
	const version = ++writeVersion;
	const persisted = pendingWrite.then(write);
	pendingWrite = persisted.catch(() => undefined);
	const done = persisted.then(async () => {
		if (version === writeVersion) await invalidate();
		if (version !== writeVersion) await latestUpdate;
	});
	latestUpdate = done.catch(() => undefined);
	return done;
}

/** 先同步装饰季节和图层，再于 cookie 落盘后刷新路由上下文。 */
export function useDecorationSwitcher(): DecorationSwitcher {
	const router = useRouter();
	const { theme, decoration, decorationLayers } = useRouteContext({ from: "__root__" });
	const [pendingPreference, setPendingPreference] = useState<DecorationPreference | null>(null);
	const [pendingLayers, setPendingLayers] = useState<DecorationLayers | null>(null);
	const preferenceVersion = useRef(0);
	const layersVersion = useRef(0);
	const latestLayers = useRef<DecorationLayers | null>(null);

	const switchDecoration = useCallback(
		async (preference: DecorationPreference) => {
			const version = ++preferenceVersion.current;
			setPendingPreference(preference);
			document.documentElement.dataset.decoration =
				resolveDecoration(preference, theme) ?? "none";
			try {
				await persistInOrder(
					() => persistDecorationPreference(preference),
					() => router.invalidate(),
				);
			} finally {
				if (version === preferenceVersion.current) setPendingPreference(null);
			}
		},
		[router, theme],
	);

	const setLayer = useCallback(
		async (layer: DecorationLayer, enabled: boolean) => {
			const version = ++layersVersion.current;
			const root = document.documentElement;
			const active = root.dataset.decorationLayers?.split(",");
			const next = {
				...(latestLayers.current ?? getClientDecorationLayers()),
				[layer]: enabled,
			};
			// 同次连续点击优先用 ref；其他入口尚未落盘的选择从 DOM 合并。
			if (!latestLayers.current && active) {
				for (const key of DECORATION_LAYERS) {
					if (key !== layer) next[key] = active.includes(key);
				}
			}
			latestLayers.current = next;
			setPendingLayers(next);
			root.dataset.decorationLayers = serializeDecorationLayers(next);
			try {
				await persistInOrder(
					() => persistDecorationLayers(next),
					() => router.invalidate(),
				);
			} finally {
				if (version === layersVersion.current) {
					latestLayers.current = null;
					setPendingLayers(null);
				}
			}
		},
		[router],
	);

	const preference = pendingPreference ?? decoration;
	return {
		preference,
		season: resolveDecoration(preference, theme),
		layers: pendingLayers ?? decorationLayers,
		switchDecoration,
		setLayer,
	};
}
