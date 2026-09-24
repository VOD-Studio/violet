import { copyText } from "@shared/lib/clipboard";
import { Button } from "@shared/ui/base/button";
import { Check, Copy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface BotTokenCardProps {
	/** 刚签发或刚回显的明文；null 表示当前无凭据可展示 */
	token: string | null;
	/** 凭据归属的 Bot 显示名 */
	botName: string;
	onDismiss: () => void;
}

/**
 * Bot 明文凭据展示卡。
 *
 * @remarks 凭据加密存在库里，关掉这张卡不会弄丢它：列表行的「查看 token」随时能再取一次。
 * 所以「完成」只是从内存丢弃，不承担「确认已保存」语义。
 */
export function BotTokenCard({ token, botName, onDismiss }: BotTokenCardProps) {
	const [copied, setCopied] = React.useState(false);
	React.useEffect(() => {
		if (token) setCopied(false);
	}, [token]);

	if (!token) return null;

	const copy = async () => {
		if (await copyText(token)) {
			setCopied(true);
			return;
		}
		toast.error("复制失败，请手动选中复制");
	};

	return (
		<section
			aria-label="Bot 凭据"
			className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-[0_4px_24px/0.05]"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<h2 className="text-sm font-medium">「{botName}」的 token</h2>
					<p className="text-xs text-muted-foreground">
						凭据加密存库里，关掉卡片也不会丢，随时可从列表重新查看。
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" variant="outline" onClick={copy}>
						{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
						{copied ? "已复制" : "复制"}
					</Button>
					<Button size="sm" variant="ghost" onClick={onDismiss} title="收起明文">
						完成
					</Button>
				</div>
			</div>
			<code className="block overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs whitespace-nowrap select-all">
				{token}
			</code>
			<p className="text-xs text-muted-foreground">
				Bot 侧以 <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> 调用{" "}
				<code className="font-mono">/api/v1/chat/bot/*</code>：先{" "}
				<code className="font-mono">GET /profile</code> 拿自己的用户 ID，再订阅{" "}
				<code className="font-mono">GET /events</code> 收消息。
			</p>
		</section>
	);
}
