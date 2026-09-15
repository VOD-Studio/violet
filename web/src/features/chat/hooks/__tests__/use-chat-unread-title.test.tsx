import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it } from "vitest";
import { useChatUnreadTitle } from "../use-chat-unread-title";

afterEach(() => {
	cleanup();
	document.title = "";
});

it("未读数变化时更新标题，清零后恢复，重复挂载不叠加前缀", () => {
	document.title = "Violet";
	const { rerender, unmount } = renderHook(({ count }) => useChatUnreadTitle(count), {
		initialProps: { count: 0 },
		wrapper: StrictMode,
	});
	expect(document.title).toBe("Violet");
	rerender({ count: 3 });
	expect(document.title).toBe("(3 条未读) Violet");
	rerender({ count: 120 });
	expect(document.title).toBe("(99+ 条未读) Violet");
	rerender({ count: 0 });
	expect(document.title).toBe("Violet");
	rerender({ count: 2 });
	unmount();
	expect(document.title).toBe("Violet");
});

it("路由替换标题节点或文本时保留未读提示，卸载恢复最新页面标题", async () => {
	document.title = "Violet";
	const { unmount } = renderHook(() => useChatUnreadTitle(1), { wrapper: StrictMode });
	expect(document.title).toBe("(1 条未读) Violet");
	act(() => {
		const title = document.createElement("title");
		title.textContent = "图集";
		document.querySelector("title")?.replaceWith(title);
	});
	await waitFor(() => expect(document.title).toBe("(1 条未读) 图集"));
	act(() => {
		const text = document.querySelector("title")?.firstChild;
		if (text) text.nodeValue = "关于";
	});
	await waitFor(() => expect(document.title).toBe("(1 条未读) 关于"));
	unmount();
	expect(document.title).toBe("关于");
});
