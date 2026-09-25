import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useOwnChatAppearance } from "../../api/appearance-queries";
import type { ChatUser } from "../../model/types";
import { ChatAppearanceEditor } from "./ChatAppearanceEditor";

/** 动作色映射到品牌强调层(palette);聊天主色快照让预览的默认 outgoing 与聊天一致。 */
const brandActionScope = {
	"--primary": "var(--brand)",
	"--primary-foreground": "var(--brand-foreground)",
	"--accent": "var(--brand-wash)",
	"--accent-foreground": "var(--brand-wash-foreground)",
	"--ring": "var(--brand-ring)",
	"--chat-primary": "var(--primary)",
	"--chat-primary-foreground": "var(--primary-foreground)",
} as CSSProperties;

export interface ChatAppearancePanelProps {
	/** 既有的账号对象;绝不要求用户手输账号 ID。 */
	user: ChatUser;
	/** 关闭面板,不改已保存设置。 */
	onClose: () => void;
}

/** 聊天工作区右侧的装扮面板:非模态,聊天照常可用,预览实时联动。 */
export function ChatAppearancePanel({ user, onClose }: ChatAppearancePanelProps) {
	const query = useOwnChatAppearance(user.id);
	// 侧栏的 backdrop-blur 会成为 fixed 后代的包含块,面板必须经 portal 挂到 body
	return createPortal(
		<aside
			aria-label="聊天外观"
			className="fixed right-0 bottom-0 top-16 z-30 flex w-full flex-col border-border border-l bg-card sm:w-104"
			style={brandActionScope}
		>
			<header className="flex flex-none items-start justify-between gap-4 px-5 pt-5">
				<div className="min-w-0">
					<h2 className="font-normal text-foreground text-xl tracking-tight">
						聊天
						<span className="text-primary underline decoration-primary/35 decoration-wavy underline-offset-4">
							外观
						</span>
					</h2>
					<p className="mt-1 font-mono text-muted-foreground text-xs">
						按账号保存，跨设备同步。
					</p>
				</div>
				<button
					type="button"
					aria-label="关闭"
					className="-me-2 -mt-2 inline-flex size-8 flex-none items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-(--brand-ring)"
					onClick={onClose}
				>
					<X aria-hidden className="size-4" />
				</button>
			</header>
			{query.data ? (
				<ChatAppearanceEditor
					key={user.id}
					initial={query.data}
					user={user}
					onClose={onClose}
				/>
			) : query.isError ? (
				<div className="flex flex-1 items-center justify-center">
					<p className="text-muted-foreground text-sm">
						无法加载已保存的外观，请稍后重试。
					</p>
				</div>
			) : (
				<div className="flex flex-1 items-center justify-center">
					<p className="text-muted-foreground text-sm">正在读取你的外观…</p>
				</div>
			)}
		</aside>,
		document.body,
	);
}
