import { useBrowserPushNotifications } from "@shared/hooks/use-browser-push";
import {
	useChatPushConfig,
	useDeleteChatPushSubscription,
	useSaveChatPushSubscription,
} from "../api/queries";

/** 管理聊天设置中的浏览器 Web Push 授权、订阅和取消订阅。 */
export function useChatPushNotifications() {
	const { data: config } = useChatPushConfig();
	const save = useSaveChatPushSubscription();
	const remove = useDeleteChatPushSubscription();
	const push = useBrowserPushNotifications<{ show_preview: boolean }>({
		enabled: config?.enabled ?? false,
		publicKey: config?.public_key ?? "",
		save: (input) => save.mutateAsync(input),
		remove: (endpoint) => remove.mutateAsync(endpoint),
	});
	return {
		enabled: push.enabled,
		supported: push.supported,
		subscribed: push.subscribed,
		permission: push.permission,
		busy: push.busy,
		enable: (showPreview: boolean) => push.enable({ show_preview: showPreview }),
		disable: push.disable,
		updatePreview: (showPreview: boolean) => push.update({ show_preview: showPreview }),
	};
}
