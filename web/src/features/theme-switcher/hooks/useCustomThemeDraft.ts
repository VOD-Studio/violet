import { type NormalizedTheme, normalizeTheme } from "@violetjs/theme";
import { useState } from "react";

const HEX_INPUT = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseDraft(value: string): NormalizedTheme | null {
	const trimmed = value.trim();
	if (!HEX_INPUT.test(trimmed)) return null;
	return normalizeTheme({
		version: 1,
		seed: trimmed.startsWith("#") ? trimmed : `#${trimmed}`,
	});
}

interface ThemeDraftState {
	theme: NormalizedTheme;
	originalSeed: string;
	draft: string;
	valid: boolean;
	showError: boolean;
	pickerOpen: boolean;
}

interface CustomThemeDraft extends ThemeDraftState {
	changeDraft: (value: string) => void;
	pickColor: (value: string) => void;
	setPickerOpen: (open: boolean) => void;
	setValidity: (valid: boolean) => void;
	validate: () => void;
}

function initialState(seed: string): ThemeDraftState {
	const theme = normalizeTheme({ version: 1, seed });
	return {
		theme,
		originalSeed: theme.seed,
		draft: theme.seed,
		valid: true,
		showError: false,
		pickerOpen: false,
	};
}

/** 非法草稿不覆盖最后合法预览；每次打开重新建立原色比较基准。 */
export function useCustomThemeDraft(open: boolean, initialSeed: string): CustomThemeDraft {
	const [wasOpen, setWasOpen] = useState(open);
	const [state, setState] = useState(() => initialState(initialSeed));
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) setState(initialState(initialSeed));
	}

	const changeDraft = (draft: string) => {
		const theme = parseDraft(draft);
		setState((current) => ({
			...current,
			draft,
			theme: theme ?? current.theme,
			valid: theme !== null,
			showError: false,
		}));
	};

	return {
		...state,
		changeDraft,
		pickColor: changeDraft,
		setPickerOpen: (pickerOpen) => setState((current) => ({ ...current, pickerOpen })),
		setValidity: (valid) =>
			setState((current) => ({
				...current,
				valid,
				showError: valid ? false : current.showError,
			})),
		validate: () => setState((current) => ({ ...current, showError: !current.valid })),
	};
}
