import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyArticleEmbed } from "../LazyArticleEmbed";
import type { ArticleEmbedDefinition, ArticleEmbedModule } from "../types";

let notify: IntersectionObserverCallback;
let observer: IntersectionObserver;

beforeEach(() => {
	vi.stubGlobal(
		"IntersectionObserver",
		class {
			constructor(callback: IntersectionObserverCallback) {
				notify = callback;
				observer = this as unknown as IntersectionObserver;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const module: ArticleEmbedModule = {
	parse: (input) => (typeof input === "string" ? input : null),
	Component: ({ config }) => <p>{String(config)}</p>,
};

function enter(target: Element) {
	act(() => notify([{ target, isIntersecting: true } as IntersectionObserverEntry], observer));
}

describe("LazyArticleEmbed", () => {
	it("远处不调用扩展加载器，近视口加载一次，离开后保持内容节点", async () => {
		const load = vi.fn().mockResolvedValue(module);
		const definition: ArticleEmbedDefinition = {
			kind: "example",
			languages: ["example"],
			defer: true,
			load,
		};
		const { container } = render(
			<LazyArticleEmbed definition={definition} source={'"可读嵌入"'} />,
		);
		expect(screen.getByText('"可读嵌入"')).toBeTruthy();
		expect(load).not.toHaveBeenCalled();
		const host = container.firstElementChild as Element;
		enter(host);
		const content = await screen.findByText("可读嵌入");
		act(() =>
			notify(
				[{ target: host, isIntersecting: false } as IntersectionObserverEntry],
				observer,
			),
		);
		enter(host);
		expect(screen.getByText("可读嵌入")).toBe(content);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("扩展加载失败只影响本块，重试重新加载并恢复", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(module);
		const definition: ArticleEmbedDefinition = {
			kind: "retry",
			languages: ["retry"],
			defer: true,
			load,
		};
		const { container } = render(
			<>
				<p>正文保留</p>
				<LazyArticleEmbed definition={definition} source={'"恢复内容"'} />
			</>,
		);
		enter(container.children[1]);
		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(screen.getByText("正文保留")).toBeTruthy();
		expect(screen.getByText('"恢复内容"')).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		expect(await screen.findByText("恢复内容")).toBeTruthy();
		expect(load).toHaveBeenCalledTimes(2);
	});
});
