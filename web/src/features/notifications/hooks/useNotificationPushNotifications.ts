import { useBrowserPushNotifications } from "@shared/hooks/use-browser-push";
import {
	useDeleteNotificationPushSubscription,
	useNotificationPushConfig,
	useSaveNotificationPushSubscription,
} from "../api/queries";

/** 管理站内通知（含推文互动）的浏览器 Web Push 授权与订阅。 */
export function useNotificationPushNotifications() {
	const { data: config } = useNotificationPushConfig();
	const save = useSaveNotificationPushSubscription();
	const remove = useDeleteNotificationPushSubscription();
	return useBrowserPushNotifications({
		enabled: config?.enabled ?? false,
		publicKey: config?.public_key ?? "",
		save: (input) => save.mutateAsync(input),
		remove: (endpoint) => remove.mutateAsync(endpoint),
	});
}
