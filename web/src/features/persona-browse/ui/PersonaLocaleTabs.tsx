import { localeLabel } from "@shared/ui/locale-switcher";
import { Fragment } from "react";
import styles from "./PersonaPage.module.css";

interface PersonaLocaleTabsProps {
	locales: readonly string[];
	value: string;
	onValueChange: (locale: string) => void;
}

/**
 * 档案语言标注：以「简体中文 / 日本語」的字典式并列呈现，当前语言以主色独立强调。
 *
 * 语言版本之间没有序列关系，因此指示不做成滑动块——切换只是当前项的颜色转移。
 */
export function PersonaLocaleTabs({ locales, value, onValueChange }: PersonaLocaleTabsProps) {
	return (
		<div role="group" aria-label="切换人设语言" className={styles.localeTabs}>
			{locales.map((locale, index) => {
				const active = locale === value;
				return (
					<Fragment key={locale}>
						{index > 0 ? (
							<span className={styles.localeDivider} aria-hidden="true">
								/
							</span>
						) : null}
						<button
							type="button"
							className={styles.localeTab}
							aria-pressed={active}
							data-active={active || undefined}
							onClick={() => {
								if (!active) onValueChange(locale);
							}}
						>
							{localeLabel(locale)}
						</button>
					</Fragment>
				);
			})}
		</div>
	);
}
