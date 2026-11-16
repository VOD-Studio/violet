import { Accordion, AccordionItem, Button, Checkbox, Switch } from "@violet/ui";
import { useId, useState } from "react";
import { useChatPushNotifications } from "../hooks/useChatPushNotifications";

interface ChatNotificationSettingsProps {
	muted: boolean;
	onMute: (muted: boolean) => void;
}

/** 会话静音与浏览器推送独立设置，避免将未授权推送误当作静音。 */
export function ChatNotificationSettings({ muted, onMute }: ChatNotificationSettingsProps) {
	const push = useChatPushNotifications();
	const [showPreview, setShowPreview] = useState(false);
	const previewID = useId();
	return (
		<section className="space-y-3 border-t border-border pt-4" aria-label="通知设置">
			<div className="flex items-center justify-between gap-2 text-sm">
				<span>消息通知</span>
				<Switch
					aria-label="消息通知"
					checked={!muted}
					onCheckedChange={(enabled) => onMute(!enabled)}
				/>
			</div>
			<Accordion type="single">
				<AccordionItem value="push" title="浏览器通知">
					<p className="mt-2">关闭标签页仍可收到消息提醒。</p>
					{push.enabled && (
						<label htmlFor={previewID} className="mt-2 flex items-center gap-2">
							<Checkbox
								id={previewID}
								checked={showPreview}
								onCheckedChange={(checked) => {
									const next = checked === true;
									setShowPreview(next);
									void push.updatePreview(next);
								}}
							/>
							显示消息摘要
						</label>
					)}
					<Button
						className="mt-3 w-full"
						disabled={push.busy || !push.enabled || !push.supported}
						loading={push.busy}
						onClick={() =>
							push.subscribed ? void push.disable() : void push.enable(showPreview)
						}
						size="sm"
						variant={push.subscribed ? "outline" : "primary"}
					>
						{push.subscribed ? "关闭浏览器通知" : "启用浏览器通知"}
					</Button>
				</AccordionItem>
			</Accordion>
		</section>
	);
}
