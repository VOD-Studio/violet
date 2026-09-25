import { copyText } from "@shared/lib/clipboard";
import { Tabs, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface TokenExportSectionProps {
	className?: string;
}

const CSS_SNIPPET = `/* Violet 品牌签名色预设 (styles/palettes/violet.css) 与基础语义 (styles/tokens.css) */
:root {
  /* 品牌紫罗兰强调（浅色：皇家鸢尾紫） */
  --brand: oklch(0.53 0.205 286);
  --brand-foreground: oklch(0.99 0 0);
  --brand-hover: oklch(0.47 0.215 286);
  --brand-wash: oklch(0.965 0.022 286);
  --brand-wash-foreground: oklch(0.35 0.14 286);
  --brand-ring: oklch(0.53 0.205 286);

  /* 画布与空间表面 */
  --background: oklch(0.992 0.003 286);
  --foreground: oklch(0.19 0.015 286);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.19 0.015 286);
  --paper: oklch(0.976 0.012 85);

  /* 状态色 */
  --destructive: oklch(0.58 0.22 25);
  --warning: oklch(0.64 0.16 75);
  --success: oklch(0.58 0.15 155);
}

.dark {
  /* 品牌紫罗兰强调（深色：星空紫水晶，全 sRGB 覆盖） */
  --brand: oklch(0.72 0.148 286);
  --brand-foreground: oklch(0.14 0.02 286);
  --brand-hover: oklch(0.77 0.138 286);
  --brand-wash: oklch(0.22 0.038 286);
  --brand-wash-foreground: oklch(0.9 0.07 286);
  --brand-ring: oklch(0.72 0.148 286);

  /* 画布与空间表面 */
  --background: oklch(0.138 0.012 286);
  --foreground: oklch(0.955 0.008 286);
  --card: oklch(0.185 0.015 286);
  --card-foreground: oklch(0.955 0.008 286);
  --paper: oklch(0.23 0.012 70);

  /* 状态色 */
  --destructive: oklch(0.68 0.2 25);
  --warning: oklch(0.78 0.16 80);
  --success: oklch(0.76 0.18 155);
}`;

const TAILWIND_SNIPPET = `/* Tailwind CSS v4 运行时工具类映射 (styles/theme.css) */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-paper: var(--paper);

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

  --color-neon-purple: var(--neon-purple);
  --color-neon-blue: var(--neon-blue);
  --color-neon-green: var(--neon-green);
  --color-neon-pink: var(--neon-pink);
  --color-neon-cyan: var(--neon-cyan);
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

				<div className="relative overflow-hidden rounded-2xl border border-edge-hairline bg-muted/40 p-5 font-mono text-xs text-foreground shadow-xs">
					<pre className="overflow-x-auto whitespace-pre leading-relaxed">
						<code>{getSnippet()}</code>
					</pre>
				</div>
			</Tabs>
		</section>
	);
}
