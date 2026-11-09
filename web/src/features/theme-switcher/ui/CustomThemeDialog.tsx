import { generateThemeCss } from "@shared/lib/theme-css";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Field,
	HsvColorPicker,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	useFieldControl,
} from "@violet/ui";
import { type ComponentProps, useId, useMemo } from "react";
import { toast } from "sonner";

import { useCustomThemeDraft } from "../hooks/useCustomThemeDraft";
import { useThemeSwitcher } from "../hooks/useThemeSwitcher";
import { CUSTOM_PREVIEW_SCOPE, CustomThemePreview } from "./CustomThemePreview";

/** 自定义主题对话框的属性。 */
export interface CustomThemeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function SeedPanel({ hexInputProps, ...props }: ComponentProps<typeof HsvColorPicker>) {
	const control = useFieldControl();
	return (
		<HsvColorPicker
			{...props}
			id={undefined}
			hexInputProps={{ ...control, ...hexInputProps }}
		/>
	);
}

/** 种子只做格式规范化，实际明暗配色与可读性由现有色阶生成器求解。 */
export function CustomThemeDialog({ open, onOpenChange }: CustomThemeDialogProps) {
	const { preset, custom, applyCustomTheme } = useThemeSwitcher("instant");
	const draft = useCustomThemeDraft(open, custom?.seed ?? THEME_PRESETS[preset].seed);
	const pickerHexId = useId();
	const css = useMemo(
		() => generateThemeCss(draft.theme, `[data-theme="${CUSTOM_PREVIEW_SCOPE}"]`),
		[draft.theme],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>自定义主题</DialogTitle>
					<DialogDescription>
						选一个种子色生成整套配色，按钮与文字会自动调到可读。
					</DialogDescription>
				</DialogHeader>
				<DialogBody className="flex flex-col gap-4">
					<style>{css}</style>
					<div className="flex items-start gap-3 p-1">
						<Popover open={draft.pickerOpen} onOpenChange={draft.setPickerOpen}>
							<PopoverTrigger asChild>
								<Button
									iconOnly
									variant="outline"
									size="md"
									aria-label="打开种子色取色面板"
									className="mt-6.5 shrink-0"
								>
									<span
										aria-hidden="true"
										className="size-6 rounded-md border border-edge-hairline"
										style={{ backgroundColor: draft.theme.seed }}
									/>
								</Button>
							</PopoverTrigger>
							<PopoverContent
								aria-label="种子色取色面板"
								className="max-h-(--radix-popover-content-available-height) w-72 overflow-y-auto p-4"
								collisionPadding={12}
							>
								<div
									role="group"
									aria-label="四季种子色"
									className="mb-3 grid grid-cols-4 gap-1 p-1"
								>
									{Object.entries(THEME_PRESETS).map(([season, theme]) => (
										<Button
											key={season}
											variant="ghost"
											aria-label={`${theme.label} · ${theme.name}`}
											aria-pressed={draft.theme.seed === theme.seed}
											className="h-auto flex-col gap-1 px-1 py-2"
											onClick={() => draft.pickColor(theme.seed)}
										>
											<span
												aria-hidden="true"
												className="size-6 rounded-full border border-edge-hairline"
												style={{ backgroundColor: theme.seed }}
											/>
											<span className="text-xs">{theme.name}</span>
										</Button>
									))}
								</div>
								<div className="p-1">
									<Field
										label="面板种子色"
										htmlFor={pickerHexId}
										error={
											draft.showError ? "请输入 #rgb 或 #rrggbb" : undefined
										}
									>
										<SeedPanel
											value={draft.theme.seed}
											originalValue={draft.originalSeed}
											onChange={draft.pickColor}
											onValidityChange={draft.setValidity}
											hexInputProps={{
												id: pickerHexId,
												name: "theme-seed",
												onInput: (event) =>
													draft.changeDraft(event.currentTarget.value),
												onBlur: draft.validate,
												onKeyDown: (event) => {
													if (event.key === "Enter") draft.validate();
												},
											}}
											onEyeDropperError={() =>
												toast.error("屏幕取色失败，请重试或输入颜色")
											}
										/>
									</Field>
								</div>
							</PopoverContent>
						</Popover>
						<Field
							label="种子色"
							className="flex-1"
							error={draft.showError ? "请输入 #rgb 或 #rrggbb" : undefined}
						>
							<Input
								value={draft.draft}
								onChange={(event) => draft.changeDraft(event.target.value)}
								onBlur={draft.validate}
								spellCheck={false}
								autoComplete="off"
								className="font-mono"
							/>
						</Field>
					</div>
					<div
						role="group"
						aria-label="生成结果预览"
						className="grid gap-3 sm:grid-cols-2"
					>
						<CustomThemePreview appearance="light" seed={draft.theme.seed} />
						<CustomThemePreview appearance="dark" seed={draft.theme.seed} />
					</div>
				</DialogBody>
				<DialogFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button
						disabled={!draft.valid}
						onClick={() => {
							if (!draft.valid) return;
							onOpenChange(false);
							void applyCustomTheme(draft.theme);
						}}
					>
						应用
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
