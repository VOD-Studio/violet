self.addEventListener("push", (event) => {
	const payload = event.data ? event.data.json() : {};
	const title = payload.title || "Violet 聊天";
	const options = {
		body: payload.body || "收到一条新消息",
		icon: "/favicon.svg",
		badge: "/favicon.svg",
		tag: payload.tag || "violet-chat",
		data: { url: payload.url || "/chat" },
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url || "/chat", self.location.origin).href;
	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			const existing = windows.find((window) => window.url.startsWith(self.location.origin));
			if (existing) return existing.focus().then(() => existing.navigate(target));
			return clients.openWindow(target);
		}),
	);
});
