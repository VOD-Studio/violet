import { copyText } from "@shared/lib/clipboard";
import { Tabs, TabsList, TabsTrigger } from "@violet/ui";
import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import defaultPalette from "../../../../../packages/ui/src/styles/palettes/violet.css?raw";
import themeMapping from "../../../../../packages/ui/src/styles/theme.css?raw";
import baseTokens from "../../../../../packages/ui/src/styles/tokens.css?raw";

export interface TokenExportSectionProps {
	className?: string;
}

const CSS_SNIPPET = `${baseTokens}\n\n${defaultPalette}`;
const TAILWIND_SNIPPET = themeMapping;

const JSON_SNIPPET = `{
  "name": "Violet Cold Fragrance Palette",
  "hue": 286,
  "tokens": {
    "brand": {
      "light": "oklch(0.53 0.205 286)",
      "dark": "oklch(0.72 0.148 286)"
    },
    "brandWash": {
      "light": "oklch(0.965 0.022 286)",
      "dark": "oklch(0.22 0.038 286)"
    },
    "canvas": {
      "light": "oklch(0.992 0.003 286)",
      "dark": "oklch(0.138 0.012 286)"
    },
    "card": {
      "light": "oklch(1 0 0)",
      "dark": "oklch(0.185 0.015 286)"
    },
    "paper": {
      "light": "oklch(0.976 0.012 85)",
      "dark": "oklch(0.23 0.012 70)"
    }
  }
}`;

/**
 * TokenExportSection - 色彩令牌代码一键导出面板。
 */
export function TokenExportSection({ className }: TokenExportSectionProps) {
	const [activeTab, setActiveTab] = useState<"css" | "tailwind" | "json">("css");
	const [copied, setCopied] = useState(false);

	const getSnippet = () => {
		if (activeTab === "css") return CSS_SNIPPET;
		if (activeTab === "tailwind") return TAILWIND_SNIPPET;
		return JSON_SNIPPET;
	};

	const handleCopy = async () => {
		const ok = await copyText(getSnippet());
		if (ok) {
			setCopied(true);
			toast.success("已复制色彩令牌配置");
			setTimeout(() => setCopied(false), 2000);
		} else {
			toast.error("复制失败，请检查剪贴板权限");
		}
	};

	return (
		<section className={cn("mb-16", className)}>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge-hairline pb-4">
				<div>
					<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
						Developer Hand-off
					</p>
					<h3 className="mt-1 text-2xl font-bold tracking-tight">色彩令牌导出</h3>
				</div>
				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-1.5 rounded-lg border border-edge-hairline bg-card px-3.5 py-2 text-xs font-medium transition-colors hover:border-brand hover:text-brand"
				>
					{copied ? (
						<Check className="size-3.5 text-emerald-500" />
					) : (
						<Copy className="size-3.5" />
					)}
					<span>复制当前片段</span>
				</button>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={(val) => setActiveTab(val as "css" | "tailwind" | "json")}
				className="w-full"
			>
				<TabsList className="mb-4">
					<TabsTrigger value="css">CSS Variables</TabsTrigger>
					<TabsTrigger value="tailwind">Tailwind v4 @theme</TabsTrigger>
					<TabsTrigger value="json">JSON Tokens</TabsTrigger>
				</TabsList>

				<div className="relative overflow-hidden rounded-2xl border border-edge-hairline bg-muted/40 p-5 font-mono text-xs text-foreground">
					<pre className="max-h-96 overflow-auto whitespace-pre leading-relaxed">
						<code>{getSnippet()}</code>
					</pre>
				</div>
			</Tabs>
		</section>
	);
}
