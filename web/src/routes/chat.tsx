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
		const hasAuthCookie =
			typeof window !== "undefined" && document.cookie.includes("violet_csrf=");
		if (!context.auth.isAuthenticated && !isSessionActive() && !hasAuthCookie) {
			throw redirect({ to: "/login", search: { redirect: location.href }, replace: true });
		}
	},
	component: ChatPage,
});
