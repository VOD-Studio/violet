import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LinkCard } from "../link-card";

const preview = {
	href: "https://example.com/article",
	title: "组件设计中的原生语义",
	description: "保留链接的键盘、焦点和修饰键行为。",
	siteName: "Example Journal",
	imageSrc: "https://example.com/cover.png",
	imageAlt: "组件设计封面",
};

describe("LinkCard", () => {
	it("图片失败移除图位，普通重渲染不重试，换图片后恢复", () => {
		const { rerender } = render(<LinkCard {...preview} />);
		fireEvent.error(screen.getByRole("img", { name: preview.imageAlt }));
		expect(screen.queryByRole("img")).toBeNull();
		expect(document.querySelector(".v-link-card__thumbnail")).toBeNull();
		expect(screen.getByText(preview.title)).toBeTruthy();
		expect(screen.getByText(preview.description)).toBeTruthy();
		rerender(<LinkCard {...preview} className="updated-layout" />);
		expect(screen.queryByRole("img")).toBeNull();
		rerender(<LinkCard {...preview} imageSrc="https://example.com/replacement.png" />);
		expect(screen.getByRole("img").getAttribute("src")).toBe(
			"https://example.com/replacement.png",
		);
	});

	it.each([
		{ href: "https://example.com/another" },
		{ title: "更新后的标题" },
		{ description: "更新后的预览说明" },
	])("预览内容更新后重试同一图片：%j", (updated) => {
		const { rerender } = render(<LinkCard {...preview} />);
		fireEvent.error(screen.getByRole("img"));
		rerender(<LinkCard {...preview} {...updated} />);
		expect(screen.getByRole("img").getAttribute("src")).toBe(preview.imageSrc);
	});

	it("无图不保留图位，忽略标点与大小写后的重复信息不呈现", () => {
		render(
			<LinkCard
				href="https://www.example.com/a"
				title="y_defect的推文"
				description="@y_defect的推文"
				siteName="EXAMPLE.COM"
			/>,
		);
		expect(screen.queryByRole("img")).toBeNull();
		expect(document.querySelector(".v-link-card__thumbnail")).toBeNull();
		expect(screen.queryByText("@y_defect的推文")).toBeNull();
		expect(screen.queryByText("EXAMPLE.COM")).toBeNull();
		expect(screen.getAllByText("example.com")).toHaveLength(1);
	});

	it("相近但不相同的描述和独立站点名仍可见", () => {
		render(<LinkCard {...preview} />);
		expect(screen.getByText(preview.description)).toBeTruthy();
		expect(screen.getByText(preview.siteName)).toBeTruthy();
		expect(screen.getByText("example.com")).toBeTruthy();
	});

	it("ref 可聚焦原生链接，修饰键和中键默认行为不被接管", () => {
		const ref = createRef<HTMLAnchorElement>();
		const click = vi.fn();
		const auxClick = vi.fn();
		const { unmount } = render(
			<LinkCard
				{...preview}
				href="#native-link"
				ref={ref}
				onClick={click}
				onAuxClick={auxClick}
			/>,
		);
		const link = screen.getByRole("link");
		expect(ref.current).toBe(link);
		ref.current?.focus();
		expect(document.activeElement).toBe(link);
		expect(fireEvent.click(link, { ctrlKey: true, metaKey: true })).toBe(true);
		expect(click.mock.calls[0]?.[0].ctrlKey).toBe(true);
		expect(click.mock.calls[0]?.[0].metaKey).toBe(true);
		const middleClick = new MouseEvent("auxclick", {
			bubbles: true,
			cancelable: true,
			button: 1,
		});
		fireEvent(link, middleClick);
		expect(auxClick).toHaveBeenCalledOnce();
		expect(middleClick.defaultPrevented).toBe(false);
		unmount();
		expect(ref.current).toBeNull();
	});

	it("调用方可取消导航、覆盖目标，并保留 callback ref 卸载清理", () => {
		const cleanup = vi.fn();
		const ref = vi.fn((_anchor: HTMLAnchorElement | null) => cleanup);
		const { unmount } = render(
			<LinkCard
				{...preview}
				ref={ref}
				target="_self"
				rel="author"
				onClick={(event) => event.preventDefault()}
			/>,
		);
		const link = screen.getByRole("link");
		expect(fireEvent.click(link)).toBe(false);
		expect(link.getAttribute("target")).toBe("_self");
		expect(link.getAttribute("rel")).toBe("author");
		expect(ref.mock.calls[0]?.[0]).toBe(link);
		unmount();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it("SSR 水合保留原生节点，水合后图片失败仍能降级", async () => {
		const ui = <LinkCard {...preview} />;
		const container = document.createElement("div");
		container.innerHTML = renderToString(ui);
		document.body.append(container);
		const serverLink = container.querySelector("a");
		const serverImage = container.querySelector("img");
		const recoverableError = vi.fn();
		let root: Root | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(container, ui, { onRecoverableError: recoverableError });
			});
			expect(container.querySelector("a")).toBe(serverLink);
			expect(container.querySelector("img")).toBe(serverImage);
			expect(recoverableError).not.toHaveBeenCalled();
			if (!serverImage) throw new Error("SSR image is missing");
			fireEvent.error(serverImage);
			expect(container.querySelector("img")).toBeNull();
			expect(container.textContent).toContain(preview.title);
		} finally {
			await act(async () => root?.unmount());
			container.remove();
		}
	});
});
