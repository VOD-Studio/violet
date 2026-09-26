import { Button } from "@shared/ui/base/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { useOwnChatAppearance } from "../../api/appearance-queries";
import type { ChatUser } from "../../model/types";
import { ChatAppearanceEditor } from "./ChatAppearanceEditor";

interface ChatAppearanceWorkspaceProps {
	user: ChatUser;
	onClose: () => void;
}

export function ChatAppearanceWorkspace({ user, onClose }: ChatAppearanceWorkspaceProps) {
	const query = useOwnChatAppearance(user.id);
	return (
		// 与 NewConversationForm 一致：仅淡入,不做方向位移,尊重系统减少动态偏好
		<motion.section
			aria-labelledby="chat-appearance-title"
			className="absolute inset-0 z-10 flex min-h-0 flex-col bg-background"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
		>
			<header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 md:px-8">
				<Button size="icon" variant="ghost" aria-label="返回聊天" onClick={onClose}>
					<ArrowLeft aria-hidden="true" className="size-5" />
				</Button>
				<h2 id="chat-appearance-title" className="text-lg font-semibold tracking-tight">
					聊天外观
				</h2>
			</header>
			{query.data ? (
				<ChatAppearanceEditor
					key={user.id}
					initial={query.data}
					user={user}
					onClose={onClose}
				/>
			) : query.isError ? (
				<div
					role="alert"
					className="flex flex-1 flex-col items-center justify-center gap-4"
				>
					<p className="text-sm text-muted-foreground">无法加载已保存的外观。</p>
					<Button
						variant="outline"
						onClick={() => {
							void query.refetch();
						}}
					>
						重试
					</Button>
				</div>
			) : (
				<p
					role="status"
					className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
				>
					正在读取你的外观…
				</p>
			)}
		</motion.section>
	);
}
