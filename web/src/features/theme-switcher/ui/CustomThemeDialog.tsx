import { generateThemeCss } from "@shared/lib/theme-css";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
} from "@violet/ui";
import { type NormalizedTheme, normalizeTheme } from "@violetjs/theme";
import { cn } from "cn";
import { useState } from "react";

import { useThemeSwitcher } from "../hooks/useThemeSwitcher";

/** 自定义主题对话框的属性。 */
export interface CustomThemeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const PREVIEW_SCOPE = "custom-preview";
/** 输入允许省略 `#`；规范化与安全校验仍由 normalizeTheme 完成。 */
const HEX_INPUT = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** 合法时返回规范化主题；只开放种子色，旋钮取默认值。 */
function parseDraft(value: string): NormalizedTheme | null {
	const trimmed = value.trim();
	if (!HEX_INPUT.test(trimmed)) return null;
	return normalizeTheme({
		version: 1,
		seed: trimmed.startsWith("#") ? trimmed : `#${trimmed}`,
	});
}

/** 一种外观下的实际生成结果：主要按钮、链接、选中态与主色文字。 */
function PreviewCard({ appearance }: { appearance: "light" | "dark" }) {
	return (
		<div
			data-theme={PREVIEW_SCOPE}
			// 预览须独立于页面外观，显式指定明暗取值
			style={{ colorScheme: appearance }}
			className={cn(
				"dialect-public space-y-3 rounded-xl border border-border bg-background p-4 text-foreground",
				appearance === "dark" && "dark",
			)}
		>
			<p className="text-xs text-muted-foreground">
				{appearance === "light" ? "浅色" : "深色"}
			</p>
			<p className="font-serif text-base leading-6">
				正文里的<span className="text-link underline underline-offset-4">链接</span>与
				<span className="text-primary">强调</span>
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<Button size="sm" tabIndex={-1}>
					主要按钮
				</Button>
				<span className="inline-flex h-6 items-center rounded-full bg-selected px-2.5 text-xs text-selected-foreground">
					已选中
				</span>
			</div>
		</div>
	);
}

/**
 * 自定义主题：取色或输入十六进制种子色，实时预览浅色与深色下的生成结果后应用。
 *
 * @remarks 每次打开都从当前生效的主题开始；预览与应用都只用规范化后的种子色，任何种子都会被调到满足对比度门槛。
 */
export function CustomThemeDialog({ open, onOpenChange }: CustomThemeDialogProps) {
	const { preset, custom, applyCustomTheme } = useThemeSwitcher("instant");
	const initialSeed = custom?.seed ?? THEME_PRESETS[preset].seed;
	const [draft, setDraft] = useState(initialSeed);
	const [wasOpen, setWasOpen] = useState(open);
	// 每次打开时丢弃上次未应用的输入
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) setDraft(initialSeed);
	}
	const theme = parseDraft(draft);
	const previewSeed = theme?.seed ?? initialSeed;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="dialect-public rounded-2xl">
				<DialogHeader>
					<DialogTitle>自定义主题</DialogTitle>
					<DialogDescription>
						选一个种子色生成整套配色，按钮与文字会自动调到可读。
					</DialogDescription>
				</DialogHeader>
				<style>
					{generateThemeCss(
						normalizeTheme({ version: 1, seed: previewSeed }),
						`[data-theme="${PREVIEW_SCOPE}"]`,
					)}
				</style>
				<div className="flex items-end gap-3">
					<input
						type="color"
						aria-label="选择种子色"
						value={previewSeed}
						onChange={(event) => setDraft(event.target.value)}
						className="size-10 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
					/>
					<Input
						label="种子色"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						invalid={!theme}
						errorMessage="请输入 #rgb 或 #rrggbb"
						spellCheck={false}
						autoComplete="off"
						className="font-mono"
						classNames={{ root: "flex-1" }}
					/>
				</div>
				<div role="group" aria-label="生成结果预览" className="grid gap-3 sm:grid-cols-2">
					<PreviewCard appearance="light" />
					<PreviewCard appearance="dark" />
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button
						disabled={!theme}
						onClick={() => {
							if (!theme) return;
							onOpenChange(false);
							void applyCustomTheme(theme);
						}}
					>
						应用
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
