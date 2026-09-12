import { ChatWorkspace } from "@features/chat/ui/ChatWorkspace";
import { isSessionActive } from "@shared/api/session";
import { createFileRoute, redirect } from "@tanstack/react-router";

/** /chat - 登录用户的私聊与私有房间工作区。 */
function ChatPage() {
	return <ChatWorkspace />;
}

export const Route = createFileRoute("/chat")({
	ssr: false,
	beforeLoad: ({ context, location }) => {
		if (!context.auth.isAuthenticated && !isSessionActive()) {
			throw redirect({ to: "/login", search: { redirect: location.href }, replace: true });
		}
	},
	component: ChatPage,
});
