// 站点级推送 service worker：聊天消息与站内通知共用。
// 一个作用域只能注册一个 service worker，两条推送通道共享同一脚本，
// 靠服务端下发的 title/body/url/tag 区分，脚本本身不含业务分支。
self.addEventListener("push", (event) => {
	const payload = event.data ? event.data.json() : {};
	const title = payload.title || "Violet";
	const options = {
		body: payload.body || "收到一条新提醒",
		icon: "/favicon.svg",
		badge: "/favicon.svg",
		tag: payload.tag || "violet",
		// renotify：同 tag 的后续推送仍要提醒，否则连续消息只响第一条
		renotify: true,
		data: { url: payload.url || "/" },
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			const existing = windows.find((window) => window.url.startsWith(self.location.origin));
			if (existing) return existing.focus().then(() => existing.navigate(target));
			return clients.openWindow(target);
		}),
	);
});
