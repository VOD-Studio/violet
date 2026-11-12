import type { UserDTO } from "@entities/user/model/types";
import { useChatMessageAlert } from "@features/chat/hooks/use-chat-message-alert";
import { MessageToast } from "@shared/ui/message-panel";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";

/**
 * 新聊天消息的轻提示：挂在右药丸下方，不在聊天室时才出现，几秒后收进铃铛角标。
 *
 * 外层容器始终挂载并带 `role="status"`，提示出现时读屏才会播报；容器自己不拦截指针。
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
