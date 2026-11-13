import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceToggle } from "../AppearanceToggle";

let storedAppearance: "dark" | undefined;

vi.mock("next-themes", () => ({
	useTheme: () => ({ theme: storedAppearance, setTheme: vi.fn() }),
}));

afterEach(() => {
	storedAppearance = undefined;
});

describe("AppearanceToggle hydration", () => {
	it.each([false, true])("文字模式 %s 的服务端首帧可水合深色偏好", async (showLabels) => {
		storedAppearance = undefined;
		const host = document.createElement("div");
		host.innerHTML = renderToString(<AppearanceToggle size="sm" showLabels={showLabels} />);
		expect(host.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(0);
		document.body.append(host);
		storedAppearance = "dark";
		const recover = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(host, <AppearanceToggle size="sm" showLabels={showLabels} />, {
					onRecoverableError: recover,
				});
			});
			expect(recover).not.toHaveBeenCalled();
			const dark = host.querySelectorAll('[role="radio"]')[1];
			expect(dark.getAttribute("aria-checked")).toBe("true");
			expect(dark.querySelector("svg.lucide-moon")).not.toBeNull();
		} finally {
			if (root) await act(async () => root?.unmount());
			host.remove();
		}
	});
});
