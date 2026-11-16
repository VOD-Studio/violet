import { Radio, RadioGroup } from "@violet/ui";
import { cn } from "cn";
import type { ChatBackground } from "../../model/appearance-background";
import { CHAT_BACKGROUNDS } from "../../model/appearance-background";
import {
	BASIC_BUBBLE_BY_ID,
	BASIC_BUBBLE_THEMES,
	BUBBLE_BY_ID,
} from "../../model/appearance-catalog";
import styles from "./ChatAppearanceEditor.module.css";
import { chatBackgroundClassName } from "./useChatBackground";

/** 仅编辑草稿;目录外的旧主题不会因打开基础选择器而被替换。 */
export interface AppearanceBasicsProps {
	themeId: string;
	background: ChatBackground;
	disabled: boolean;
	onThemeChange: (id: string) => void;
	onBackgroundChange: (background: ChatBackground) => void;
}

export function AppearanceBasics({
	themeId,
	background,
	disabled,
	onThemeChange,
	onBackgroundChange,
}: AppearanceBasicsProps) {
	const theme = BASIC_BUBBLE_BY_ID.get(themeId) ?? BUBBLE_BY_ID.get(themeId);
	const themeName = theme?.name ?? themeId;
	return (
		<div className={styles.choices}>
			<div>
				<div className={styles.sectionHeading}>
					<h3 className={styles.sectionTitle}>我的气泡</h3>
					<span className={styles.currentTheme} title={themeName}>
						{themeName}
					</span>
				</div>
				<RadioGroup
					legend="我的气泡"
					value={themeId}
					onValueChange={onThemeChange}
					appearance="card"
					className={styles.basicOptions}
					disabled={disabled}
				>
					{BASIC_BUBBLE_THEMES.map((theme) => (
						<Radio
							key={theme.id}
							value={theme.id}
							label={
								<span className={styles.optionLabel}>
									<i
										className={styles.swatch}
										data-theme={theme.id || "season"}
										aria-hidden="true"
									/>
									{theme.name}
								</span>
							}
						/>
					))}
				</RadioGroup>
			</div>
			<div>
				<h3 className={styles.sectionTitle}>聊天背景</h3>
				<RadioGroup
					legend="聊天背景"
					value={background}
					onValueChange={(value) => {
						const option = CHAT_BACKGROUNDS.find((item) => item.id === value);
						if (option) {
							onBackgroundChange(option.id);
						}
					}}
					className={styles.backgroundOptions}
					disabled={disabled}
				>
					{CHAT_BACKGROUNDS.map((option) => (
						<Radio
							key={option.id}
							value={option.id}
							label={
								<span className={styles.backgroundLabel}>
									<span
										aria-hidden="true"
										className={cn(
											styles.wallSwatch,
											chatBackgroundClassName(option.id),
										)}
									/>
									{option.name}
								</span>
							}
						/>
					))}
				</RadioGroup>
			</div>
		</div>
	);
}
