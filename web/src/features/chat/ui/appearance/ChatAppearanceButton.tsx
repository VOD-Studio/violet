import { useMe } from "@features/auth/api/queries";
import { Button } from "@shared/ui/base/button";
import { Palette } from "lucide-react";
import { useState } from "react";
import { ChatAppearanceDialog } from "./ChatAppearanceDialog";

/** 桌面侧栏与移动会话页共用的外观编辑入口。 */
export function ChatAppearanceButton() {
	const { data: me } = useMe();
	const [open, setOpen] = useState(false);
	if (!me) return null;
	return (
		<>
			<Button
				size="icon"
				variant="ghost"
				aria-label="设置聊天外观"
				title="聊天外观"
				onClick={() => setOpen(true)}
			>
				<Palette aria-hidden="true" className="size-5" />
			</Button>
			{open && (
				<ChatAppearanceDialog
					key={me.id}
					open={open}
					user={{
						id: me.id,
						username: me.username,
						display_name: me.display_name ?? "",
						avatar_url: me.avatar_url ?? "",
					}}
					onOpenChange={setOpen}
				/>
			)}
		</>
	);
}
