import { useEffect, useRef, useState } from "react";
import { type HsvColor, hexToHsv, hsvToHex, normalizeHexColor } from "./hsv";

interface ColorPickerState {
	hsv: HsvColor;
	draft: string | null;
	invalid: boolean;
}

interface ColorPickerOptions {
	value: string;
	onChange: (hex: string) => void;
	onColorCommit?: (hex: string) => void;
	onValidityChange?: (valid: boolean) => void;
}

interface ColorPickerController extends ColorPickerState {
	hex: string;
	commit: (hsv: HsvColor, complete?: boolean) => void;
	finish: () => void;
	input: (text: string) => void;
	blur: () => void;
	/** 表单 reset：草稿回到当前颜色对应的 HEX，清内部错误；不触发 onChange。 */
	reset: () => void;
}

export function useColorPicker({
	value,
	onChange,
	onColorCommit,
	onValidityChange,
}: ColorPickerOptions): ColorPickerController {
	const normalized = normalizeHexColor(value) ?? hsvToHex(220, 0.8, 0.9);
	const [previousValue, setPreviousValue] = useState(normalized);
	const [state, setState] = useState<ColorPickerState>(() => ({
		hsv: hexToHsv(normalized),
		draft: null,
		invalid: false,
	}));
	const current = useRef(state);
	current.current = state;
	// 宿主最后一次得知的合法性；只在真实变化时通知，初始合法。
	const reported = useRef(true);
	const report = (valid: boolean) => {
		if (reported.current === valid) return;
		reported.current = valid;
		onValidityChange?.(valid);
	};
	const valid = state.draft === null || normalizeHexColor(state.draft) !== null;
	// 外部更新替换草稿发生在渲染阶段，通知放到提交之后，避免渲染中更新宿主状态。
	useEffect(() => {
		report(valid);
	});
	if (previousValue !== normalized) {
		setPreviousValue(normalized);
		// A controlled echo must not quantize HSV or replace a partially typed HEX draft.
		if (hsvToHex(state.hsv.h, state.hsv.s, state.hsv.v) !== normalized) {
			const next = { hsv: hexToHsv(normalized), draft: null, invalid: false };
			current.current = next;
			setState(next);
		}
	}
	const update = (next: ColorPickerState) => {
		current.current = next;
		setState(next);
	};
	const commit = (hsv: HsvColor, complete = false) => {
		update({ hsv, draft: null, invalid: false });
		report(true);
		const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
		onChange(hex);
		if (complete) onColorCommit?.(hex);
	};
	return {
		...state,
		hex: hsvToHex(state.hsv.h, state.hsv.s, state.hsv.v),
		commit,
		finish: () => {
			const { h, s, v } = current.current.hsv;
			onColorCommit?.(hsvToHex(h, s, v));
		},
		input: (text) => {
			const draft = text.replace(/^\s*#/, "").toUpperCase();
			const hex = normalizeHexColor(draft);
			update({ hsv: hex ? hexToHsv(hex) : current.current.hsv, draft, invalid: false });
			report(hex !== null);
			if (hex) onChange(hex);
		},
		blur: () => {
			const { draft } = current.current;
			if (draft === null) return;
			const hex = normalizeHexColor(draft);
			update({ ...current.current, draft: hex ? null : draft, invalid: !hex });
			report(hex !== null);
			if (hex) onColorCommit?.(hex);
		},
		reset: () => {
			update({ ...current.current, draft: null, invalid: false });
			report(true);
		},
	};
}
