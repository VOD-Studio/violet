import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { notifySettingsChanged } from "../cache-events";
import { settingsKeys } from "../keys";

it("设置保存后忽略迟到的首次公开配置响应", async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	let finishOld!: (value: { footer_github_url: string }) => void;
	const old = new Promise<{ footer_github_url: string }>((resolve) => {
		finishOld = resolve;
	});
	let reads = 0;
	const latest = { footer_github_url: "https://github.com/VOD-Studio/violet" };
	const observer = new QueryObserver(client, {
		queryKey: settingsKeys.public(),
		queryFn: () => (++reads === 1 ? old : Promise.resolve(latest)),
	});
	const unsubscribe = observer.subscribe(() => undefined);
	try {
		notifySettingsChanged(client);
		finishOld({ footer_github_url: "https://github.com/stale" });
		await waitFor(() => expect(observer.getCurrentResult().data).toEqual(latest));
	} finally {
		unsubscribe();
		client.clear();
	}
});
