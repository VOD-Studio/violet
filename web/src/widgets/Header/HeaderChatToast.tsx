import type { UserDTO } from "@entities/user/model/types";
import { useChatMessageAlert } from "@features/chat/hooks/use-chat-message-alert";
import { MessageToast } from "@shared/ui/message-panel";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";

/**
 * 非聊天室页面收到新聊天消息时的临时提示。
 *
 * @remarks status 容器常驻，内容出现时供读屏播报；悬停与聚焦会暂停收起计时。
 */
const HeaderChatToast = ({ user }: { user?: UserDTO | null }) => {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const { alert, reply, setPaused } = useChatMessageAlert({
		currentUserID: user?.id,
		inChatRoom: pathname === "/chat" || pathname.startsWith("/chat/"),
	});
	return (
		<div
			role="status"
			className="pointer-events-none absolute top-full right-3 mt-3 sm:right-4"
		>
			<AnimatePresence>
				{alert ? (
					<MessageToast
						key={alert.conversationId}
						alert={alert}
						onReply={reply}
						onPauseChange={setPaused}
						className="pointer-events-auto"
					/>
				) : null}
			</AnimatePresence>
		</div>
	);
};

export default HeaderChatToast;
