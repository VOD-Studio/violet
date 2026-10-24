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
	it("服务端无浏览器外观时仍能水合深色偏好并选中暗色", async () => {
		storedAppearance = undefined;
		const host = document.createElement("div");
		host.innerHTML = renderToString(<AppearanceToggle size="sm" />);
		expect(host.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(0);
		document.body.append(host);
		storedAppearance = "dark";
		const recover = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(host, <AppearanceToggle size="sm" />, {
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
