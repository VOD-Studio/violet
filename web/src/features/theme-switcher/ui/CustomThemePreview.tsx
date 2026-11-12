import { hexToOklch, parseOklch } from "@shared/lib/color-math";
import { Button } from "@violet/ui";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

export const CUSTOM_PREVIEW_SCOPE = "custom-preview";

interface CustomThemePreviewProps {
	appearance: "light" | "dark";
	seed: string;
}

function describeLightness(name: string, difference: number) {
	const points = Math.abs(difference).toFixed(1);
	return difference === 0
		? `${name}明度与种子色相同`
		: `${name}明度比种子色${difference < 0 ? "低" : "高"} ${points} 个百分点`;
}

/** 调节说明直接读取预览实际应用的按钮与链接色，不另生成色阶。 */
export function CustomThemePreview({ appearance, seed }: CustomThemePreviewProps) {
	const button = useRef<HTMLButtonElement>(null);
	const link = useRef<HTMLSpanElement>(null);
	const [adjustment, setAdjustment] = useState<string | null>(null);

	useEffect(() => {
		const update = () => {
			if (!button.current || !link.current) return;
			const original = hexToOklch(seed);
			const primary = parseOklch(getComputedStyle(button.current).backgroundColor);
			const linkColor = parseOklch(getComputedStyle(link.current).color);
			if (!original || !primary || !linkColor) {
				setAdjustment(null);
				return;
			}
			const primaryDifference = Math.round((primary.l - original.l) * 1000) / 10;
			const linkDifference = Math.round((linkColor.l - original.l) * 1000) / 10;
			setAdjustment(
				`${describeLightness("按钮", primaryDifference)}；${describeLightness("链接", linkDifference)}（OKLCH）。`,
			);
		};
		update();
		const contrast = window.matchMedia("(prefers-contrast: more)");
		contrast.addEventListener("change", update);
		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		return () => {
			contrast.removeEventListener("change", update);
			observer.disconnect();
		};
	}, [seed]);

	return (
		<div
			data-theme={CUSTOM_PREVIEW_SCOPE}
			style={{ colorScheme: appearance }}
			className={cn(
				"space-y-3 rounded-xl border border-border bg-background p-4 text-foreground",
				appearance === "dark" && "dark",
			)}
		>
			<p className="text-xs text-muted-foreground">
				{appearance === "light" ? "浅色" : "深色"}
			</p>
			<p className="font-serif text-base leading-6">
				正文里的
				<span ref={link} className="text-link underline underline-offset-4">
					链接
				</span>
				与<span className="text-primary">强调</span>
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					ref={button}
					variant="primary"
					size="sm"
					tabIndex={-1}
					style={{ transition: "none" }}
				>
					主要按钮
				</Button>
				<span className="inline-flex h-6 items-center rounded-full bg-selected px-2.5 text-xs text-selected-foreground">
					已选中
				</span>
			</div>
			{adjustment && <p className="text-xs leading-5 text-muted-foreground">{adjustment}</p>}
		</div>
	);
}
