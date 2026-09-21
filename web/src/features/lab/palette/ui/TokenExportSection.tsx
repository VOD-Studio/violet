import { Tabs, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { cn } from "@shared/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface TokenExportSectionProps {
	className?: string;
}

const CSS_SNIPPET = `/* Violet 品牌签名色预设 (styles/palettes/violet.css) */
:root {
  --brand: oklch(0.53 0.205 286);
  --brand-foreground: oklch(0.99 0 0);
  --brand-hover: oklch(0.47 0.215 286);
  --brand-wash: oklch(0.965 0.022 286);
  --brand-wash-foreground: oklch(0.35 0.14 286);
  --brand-ring: oklch(0.53 0.205 286);
}

.dark {
  --brand: oklch(0.72 0.148 286);
  --brand-foreground: oklch(0.14 0.02 286);
  --brand-hover: oklch(0.77 0.138 286);
  --brand-wash: oklch(0.22 0.038 286);
  --brand-wash-foreground: oklch(0.9 0.07 286);
  --brand-ring: oklch(0.72 0.148 286);
}`;

const TAILWIND_SNIPPET = `/* Tailwind CSS v4 运行时工具类映射 (styles/theme.css) */
@theme inline {
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-brand-hover: var(--brand-hover);
  --color-brand-wash: var(--brand-wash);
  --color-brand-wash-foreground: var(--brand-wash-foreground);
  --color-brand-ring: var(--brand-ring);
  
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
}`;

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

	const handleCopy = () => {
		navigator.clipboard.writeText(getSnippet());
		setCopied(true);
		toast.success("已复制色彩令牌配置");
		setTimeout(() => setCopied(false), 2000);
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

				<div className="relative overflow-hidden rounded-2xl border border-edge-hairline bg-muted/40 p-5 font-mono text-xs text-foreground shadow-xs">
					<pre className="overflow-x-auto whitespace-pre leading-relaxed">
						<code>{getSnippet()}</code>
					</pre>
				</div>
			</Tabs>
		</section>
	);
}
