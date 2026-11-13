import { MessageCenter } from "@shared/ui/message-panel";
import { useState } from "react";
import { useNotificationPanel } from "../hooks/use-notification-panel";

/** 后台独立铃铛入口；公共页头使用同一通知数据驱动整枚胶囊。 */
const NotificationBell = () => {
	const [open, setOpen] = useState(false);
	const panel = useNotificationPanel({ onNavigate: () => setOpen(false) });
	return <MessageCenter {...panel} open={open} onOpenChange={setOpen} />;
};

export default NotificationBell;
