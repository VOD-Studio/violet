import { MessageCenter, type MessagePanelChat } from "@shared/ui/message-panel";
import { useState } from "react";
import { useNotificationPanel } from "../hooks/use-notification-panel";

/** 聊天数据与动作；聊天室链接由通知模块接入路由。 */
export type NotificationBellChat = Omit<MessagePanelChat, "LinkComponent">;

interface NotificationBellProps {
	/** 省略时只显示通知。 */
	chat?: NotificationBellChat;
}

/** 独立铃铛入口与通知数据接线；面板的业务数据不依赖弹层形态。 */
const NotificationBell = ({ chat }: NotificationBellProps) => {
	const [open, setOpen] = useState(false);
	const panel = useNotificationPanel({ chat, onNavigate: () => setOpen(false) });
	return <MessageCenter {...panel} open={open} onOpenChange={setOpen} />;
};

export default NotificationBell;
