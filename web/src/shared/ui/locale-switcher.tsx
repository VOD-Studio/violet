import { cn } from "@shared/lib/utils";
import { Segmented } from "@shared/ui/segmented";

const LOCALE_LABELS: Readonly<Record<string, string>> = {
	"zh-CN": "简体中文",
	"zh-TW": "繁體中文",
	"ja-JP": "日本語",
	"en-US": "English",
	"ko-KR": "한국어",
	"fr-FR": "Français",
	"de-DE": "Deutsch",
	"es-ES": "Español",
};

export const COMMON_PERSONA_LOCALES = Object.freeze(["zh-CN", "ja-JP", "en-US", "zh-TW", "ko-KR"]);

export interface LocaleSwitcherProps {
	locales: readonly string[];
	value: string;
	onValueChange: (locale: string) => void;
	/** 为该次切换语境命名，例如“切换人设语言”。 */
	ariaLabel: string;
	className?: string;
	compact?: boolean;
}

/** 返回稳定的语言自称，未知语言回退为原始 BCP 47 代码。 */
export function localeLabel(locale: string): string {
	return LOCALE_LABELS[locale] ?? locale;
}

/** 校验并规范化用户输入的 BCP 47 语言代码。 */
export function normalizeLocaleInput(value: string): string | null {
	const raw = value.trim();
	if (!raw || raw.length > 35 || raw.includes("_")) return null;
	try {
		const locale = new Intl.Locale(raw).toString();
		return locale === "und" ? null : locale;
	} catch {
		return null;
	}
}

/** 少量已配置语言之间的直接切换器；不把高频切换藏进下拉菜单。 */
export function LocaleSwitcher({
	locales,
	value,
	onValueChange,
	ariaLabel,
	className,
	compact = false,
}: LocaleSwitcherProps) {
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={cn("max-w-full overflow-x-auto", className)}
		>
			<Segmented
				value={value}
				onValueChange={onValueChange}
				segments={locales.map((locale) => ({
					value: locale,
					label: compact ? locale.split("-")[0]?.toUpperCase() : localeLabel(locale),
				}))}
				rounded="full"
				itemClassName={compact ? "px-2.5" : "px-3.5"}
			/>
		</div>
	);
}
