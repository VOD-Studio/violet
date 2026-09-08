import { localeLabel } from "@shared/ui/locale-switcher";
import styles from "./PersonaPage.module.css";

interface PersonaLocaleTabsProps {
	locales: readonly string[];
	value: string;
	onValueChange: (locale: string) => void;
}

/**
 * 人设档案专属语言切换：
 *
 * 采用极简画报文本排版（非 segment 分段器），由纯净文字与中正圆点构成。
 * 当前语种以项目主题色（暖珊瑚）直接点亮，无背景胶囊与滑动阻尼，安静融入版面。
 */
export function PersonaLocaleTabs({ locales, value, onValueChange }: PersonaLocaleTabsProps) {
	return (
		<div role="group" aria-label="切换人设语言" className={styles.localeSwitcher}>
			{locales.map((locale, index) => {
				const active = locale === value;
				return (
					<span key={locale} className={styles.localeItemWrapper}>
						{index > 0 ? (
							<span className={styles.localeSeparator} aria-hidden="true">
								·
							</span>
						) : null}
						<button
							type="button"
							className={styles.localeBtn}
							aria-pressed={active}
							data-active={active || undefined}
							onClick={() => {
								if (!active) onValueChange(locale);
							}}
						>
							{localeLabel(locale)}
						</button>
					</span>
				);
			})}
		</div>
	);
}
