import { Button } from "@violet/ui";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { useChatSettings, useUpdateChatSettings } from "../api/queries";

/** 聊天列表头部的在线状态开关：隐身后其他成员看到的是离线。 */
export function PresenceVisibilityButton() {
	const settings = useChatSettings();
	const update = useUpdateChatSettings();
	if (settings.isError) {
		return (
			<Button
				iconOnly
				aria-label="在线状态：读取失败，点击重试"
				className="size-9 rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				onClick={() => void settings.refetch()}
				size="md"
				title="在线状态读取失败，点击重试"
				variant="ghost"
			>
				<RotateCcw className="size-5" />
			</Button>
		);
	}
	const hidden = settings.data?.hide_online === true;
	const Icon = hidden ? EyeOff : Eye;
	return (
		<Button
			iconOnly
			aria-label={hidden ? "在线状态：已隐身" : "在线状态：对成员可见"}
			aria-pressed={hidden}
			className="size-9 rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
			disabled={!settings.data || update.isPending}
			onClick={() => update.mutate({ hide_online: !hidden })}
			size="md"
			title={hidden ? "已隐身：其他成员看到你离线，点击恢复" : "对成员可见，点击隐身"}
			variant="ghost"
		>
			<Icon className="size-5" />
		</Button>
	);
}
