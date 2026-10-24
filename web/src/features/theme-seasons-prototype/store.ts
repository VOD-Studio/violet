/** PROTOTYPE（#645）：样稿状态只在内存里，URL 参数只用于分享当前组合。 */
import { create } from "zustand";

import { currentSeason, DIRECTIONS, type DirectionKey, type SeasonKey } from "./directions";

export type ThemePref = "follow" | SeasonKey | "custom";
export type DecoPref = "follow" | "none" | SeasonKey;
export type EntryVariant = "A" | "B" | "C";
export interface Layers {
	illustration: boolean;
	particles: boolean;
	ornaments: boolean;
}

interface Tuning {
	seed: string;
	neutralChroma: number;
}

interface PrototypeState {
	/** 每个季节当前采用哪个方向 */
	picks: Record<SeasonKey, DirectionKey>;
	themePref: ThemePref;
	customSeed: string;
	decoPref: DecoPref;
	entry: EntryVariant;
	layers: Layers;
	/** 对照板里对种子色、旋钮的临时微调 */
	tuning: Record<string, Tuning>;
	setPick: (season: SeasonKey, key: DirectionKey) => void;
	setAllPicks: (key: DirectionKey) => void;
	setThemePref: (pref: ThemePref) => void;
	setCustomSeed: (seed: string) => void;
	setDecoPref: (pref: DecoPref) => void;
	setEntry: (entry: EntryVariant) => void;
	toggleLayer: (layer: keyof Layers) => void;
	tune: (id: string, tuning: Partial<Tuning>) => void;
	resetTuning: (id: string) => void;
}

export const usePrototype = create<PrototypeState>((set) => ({
	picks: { spring: "A", summer: "A", autumn: "A", winter: "A" },
	themePref: "follow",
	customSeed: "#3a7bd5",
	decoPref: "follow",
	entry: "A",
	layers: { illustration: true, particles: true, ornaments: true },
	tuning: {},
	setPick: (season, key) => set((state) => ({ picks: { ...state.picks, [season]: key } })),
	setAllPicks: (key) => set({ picks: { spring: key, summer: key, autumn: key, winter: key } }),
	setThemePref: (themePref) => set({ themePref }),
	setCustomSeed: (customSeed) => set({ customSeed }),
	setDecoPref: (decoPref) => set({ decoPref }),
	setEntry: (entry) => set({ entry }),
	toggleLayer: (layer) =>
		set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),
	tune: (id, tuning) =>
		set((state) => {
			const base = DIRECTIONS.find((direction) => direction.id === id);
			const current = state.tuning[id] ?? {
				seed: base?.seed ?? "#684dda",
				neutralChroma: base?.neutralChroma ?? 0.015,
			};
			return { tuning: { ...state.tuning, [id]: { ...current, ...tuning } } };
		}),
	resetTuning: (id) =>
		set((state) => {
			const { [id]: _removed, ...rest } = state.tuning;
			return { tuning: rest };
		}),
}));

/** 方向的实际种子与旋钮（含对照板微调）。 */
export function useTuned(id: string) {
	const tuning = usePrototype((state) => state.tuning[id]);
	const base = DIRECTIONS.find((direction) => direction.id === id) ?? DIRECTIONS[0];
	return {
		seed: tuning?.seed ?? base.seed,
		neutralChroma: tuning?.neutralChroma ?? base.neutralChroma,
	};
}

/** 访客偏好解析出的季节；自定义主题返回 null。 */
export function resolveSeason(pref: ThemePref): SeasonKey | null {
	if (pref === "custom") return null;
	return pref === "follow" ? currentSeason() : pref;
}

export function resolveDecoSeason(decoPref: DecoPref, themePref: ThemePref): SeasonKey | null {
	if (decoPref === "none") return null;
	if (decoPref === "follow") return themePref === "custom" ? null : resolveSeason(themePref);
	return decoPref;
}
