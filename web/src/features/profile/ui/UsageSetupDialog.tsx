import { httpClient } from "@shared/api/http";
import { copyText } from "@shared/lib/clipboard";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@violet/ui";
import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const installCommand = "omp plugin marketplace add VOD-Studio/violet\nomp install omp-usage@violet";

/** 原生插件安装命令与本站配置模板，不接收或保存令牌。 */
export function UsageSetupDialog() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline">
					<Terminal aria-hidden className="size-4" />
					接入 OMP
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
				<UsageSetupContent />
			</DialogContent>
		</Dialog>
	);
}

function UsageSetupContent() {
	const base = new URL(httpClient.defaults.baseURL ?? "/api/v1", window.location.origin);
	base.pathname = base.pathname.replace(/\/api\/v1\/?$/, "");
	const configuration = JSON.stringify(
		{ url: base.href.replace(/\/$/, ""), pat: "<TOKEN>" },
		null,
		2,
	);

	return (
		<>
			<DialogHeader className="text-left">
				<DialogTitle>接入 OMP</DialogTitle>
				<DialogDescription>仅上传用量，不包含对话正文。</DialogDescription>
			</DialogHeader>
			<SetupCode label="安装命令" code={installCommand} />
			<div className="min-w-0 space-y-3">
				<SetupCode label="连接配置" code={configuration} />
				<p className="text-sm leading-relaxed text-muted-foreground">
					保存到 <code className="font-mono text-xs">~/.omp/omp-usage.json</code>
					，文件权限设为 600。将 <code className="font-mono text-xs">&lt;TOKEN&gt;</code>
					替换为仅含 <code className="font-mono text-xs">usage:write</code> 权限的
					<a
						href="/admin/mcp"
						target="_blank"
						rel="noreferrer"
						className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						访问令牌
					</a>
					。
				</p>
			</div>
			<p className="text-xs text-muted-foreground">配置后重启 OMP，用量每分钟同步。</p>
		</>
	);
}

function SetupCode({ label, code }: { label: string; code: string }) {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		if (await copyText(code)) setCopied(true);
		else toast.error("复制失败，请手动选择内容。");
	};
	return (
		<div className="min-w-0 space-y-2">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-medium">{label}</h3>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => void copy()}
					aria-label={copied ? `已复制${label}` : `复制${label}`}
					title={copied ? `已复制${label}` : `复制${label}`}
				>
					{copied ? (
						<Check aria-hidden className="size-4" />
					) : (
						<Copy aria-hidden className="size-4" />
					)}
				</Button>
			</div>
			<pre className="max-w-full overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-xs leading-6">
				<code>{code}</code>
			</pre>
		</div>
	);
}
