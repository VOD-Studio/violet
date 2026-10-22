import type { ScheduleMode } from "@violetjs/inkline";
import { create } from "zustand";
import type { ExportSettings } from "../lib/export-code";
import type { ArtworkKey } from "./artworks";

/** 工作台在各节之间共享的选择；舞台与右侧面板分处两棵子树，靠它同步。 */
interface WorkbenchState {
	artwork: ArtworkKey;
	mode: ScheduleMode;
	/** 播放倍率，只影响舞台播放，不影响导出 */
	rate: number;
	exportSettings: ExportSettings;
	/** 笔一节的压感强度，0–1 */
	pressure: number;
	/** 手法一节的 seed */
	seed: number;
	/** 换色一节的配色：跟随站点明暗，或固定浅色、深色 */
	paletteTheme: "site" | "light" | "dark";
	set: (patch: Partial<Omit<WorkbenchState, "set">>) => void;
	setExport: (patch: Partial<ExportSettings>) => void;
}

export const useWorkbenchStore = create<WorkbenchState>()((set) => ({
	artwork: "coffee",
	mode: "stagger",
	rate: 1,
	exportSettings: {
		format: "gif",
		width: 480,
		fps: 25,
		duration: 8,
		hold: 1,
		loop: true,
		bitrate: null,
	},
	pressure: 0.6,
	seed: 7,
	paletteTheme: "site",
	set: (patch) => set(patch),
	setExport: (patch) =>
		set((state) => ({ exportSettings: { ...state.exportSettings, ...patch } })),
}));
