/** 键帽的显示平台：macOS 写符号修饰键，其余平台写文字。 */
export type KbdPlatform = "mac" | "other";

/** 逻辑键名。`mod` 是各平台的主修饰键：macOS 为 ⌘，其余为 Ctrl。 */
export type KbdLogicalKey =
	| "mod"
	| "ctrl"
	| "alt"
	| "shift"
	| "enter"
	| "esc"
	| "tab"
	| "backspace"
	| "space"
	| "up"
	| "down"
	| "left"
	| "right";

/** 逻辑键名，或原样显示的字符串（如 `"K"`、`"F5"`、`"/"`）。 */
export type KbdKey = KbdLogicalKey | (string & {});

export interface KbdKeyFace {
	label: string;
	/** 仅符号键与缩写需要读屏名称；字母与完整单词不加。 */
	ariaLabel?: string;
}

const ARROWS = {
	up: { label: "↑", ariaLabel: "上方向键" },
	down: { label: "↓", ariaLabel: "下方向键" },
	left: { label: "←", ariaLabel: "左方向键" },
	right: { label: "→", ariaLabel: "右方向键" },
} as const satisfies Record<string, KbdKeyFace>;

const SHARED: Record<string, KbdKeyFace> = {
	...ARROWS,
	esc: { label: "Esc", ariaLabel: "Escape" },
	space: { label: "Space" },
};

const MAC: Record<string, KbdKeyFace> = {
	...SHARED,
	mod: { label: "⌘", ariaLabel: "Command" },
	ctrl: { label: "⌃", ariaLabel: "Control" },
	alt: { label: "⌥", ariaLabel: "Option" },
	shift: { label: "⇧", ariaLabel: "Shift" },
	enter: { label: "↵", ariaLabel: "Return" },
	tab: { label: "⇥", ariaLabel: "Tab" },
	backspace: { label: "⌫", ariaLabel: "Delete" },
};

const OTHER: Record<string, KbdKeyFace> = {
	...SHARED,
	mod: { label: "Ctrl" },
	ctrl: { label: "Ctrl" },
	alt: { label: "Alt" },
	shift: { label: "Shift" },
	enter: { label: "Enter" },
	tab: { label: "Tab" },
	backspace: { label: "Backspace" },
};

const FACES = { mac: MAC, other: OTHER } as const;

/** 各平台的修饰符排列顺序：macOS 为 ⌃ ⌥ ⇧ ⌘，其余为 Ctrl Alt Shift。 */
const MODIFIER_ORDER = {
	mac: ["ctrl", "alt", "shift", "mod"],
	other: ["mod", "ctrl", "alt", "shift"],
} as const;

/** 逻辑键在指定平台上的显示文字与读屏名称；未登记的字符串原样返回。 */
export function formatKey(key: KbdKey, platform: KbdPlatform): KbdKeyFace {
	return Object.hasOwn(FACES[platform], key) ? FACES[platform][key] : { label: key };
}

/** 修饰符按平台固定顺序排在前面，其余键保持传入顺序。 */
export function orderKeys(keys: readonly KbdKey[], platform: KbdPlatform): KbdKey[] {
	const order: readonly string[] = MODIFIER_ORDER[platform];
	const rank = (key: KbdKey) => {
		const index = order.indexOf(key);
		return index === -1 ? order.length : index;
	};
	return [...keys].sort((a, b) => rank(a) - rank(b));
}
