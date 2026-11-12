import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type ComponentProps, createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	List,
	ListItem,
	ListItemAction,
	ListItemChevron,
	ListItemContent,
	ListItemDescription,
	ListItemIcon,
	ListItemTitle,
	ListItemValue,
} from "../list";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const row = (name: string | RegExp) =>
	screen.getByText(name).closest(".v-list__row") as HTMLElement;
const hover = (el: Element) => fireEvent.pointerOver(el, { pointerType: "mouse" });

describe("List 结构", () => {
	it("是 ul，每行一个 li，名称与 className、ref、原生属性落在 ul 上", () => {
		const ref = createRef<HTMLUListElement>();
		render(
			<List aria-label="设置" className="extra" ref={ref} data-testid="list">
				<ListItem>
					<ListItemTitle>语言</ListItemTitle>
				</ListItem>
				<ListItem>
					<ListItemTitle>外观</ListItemTitle>
				</ListItem>
			</List>,
		);
		const list = screen.getByRole("list", { name: "设置" });
		expect(list.tagName).toBe("UL");
		expect(list.classList.contains("extra")).toBe(true);
		expect(list.dataset.testid).toBe("list");
		expect(ref.current).toBe(list);
		expect(within(list).getAllByRole("listitem")).toHaveLength(2);
	});

	it("槽位部件各自落在对应元素上并保留文字", () => {
		render(
			<List aria-label="设置">
				<ListItem>
					<ListItemIcon data-testid="icon">
						<svg />
					</ListItemIcon>
					<ListItemContent>
						<ListItemTitle>评论通知</ListItemTitle>
						<ListItemDescription>有人回复我的评论时提醒</ListItemDescription>
					</ListItemContent>
					<ListItemValue>已开启</ListItemValue>
					<ListItemChevron data-testid="chevron" />
				</ListItem>
			</List>,
		);
		const content = screen.getByText("评论通知").parentElement as HTMLElement;
		expect(content.contains(screen.getByText("有人回复我的评论时提醒"))).toBe(true);
		expect(screen.getByText("已开启")).toBeTruthy();
		expect(screen.getByTestId("chevron").getAttribute("aria-hidden")).toBe("true");
	});
});

describe("整行可点", () => {
	it("传了 onClick 的行本身是 button，type 默认为 button", () => {
		const onClick = vi.fn();
		render(
			<List aria-label="设置">
				<ListItem onClick={onClick}>
					<ListItemTitle>语言</ListItemTitle>
				</ListItem>
			</List>,
		);
		const button = screen.getByRole("button", { name: "语言" }) as HTMLButtonElement;
		expect(button.type).toBe("button");
		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("可聚焦，Enter 与 Space 的按下不被组件取消，留给原生激活", () => {
		render(
			<List aria-label="设置">
				<ListItem onClick={() => {}}>
					<ListItemTitle>语言</ListItemTitle>
				</ListItem>
			</List>,
		);
		const button = screen.getByRole("button", { name: "语言" });
		button.focus();
		expect(document.activeElement).toBe(button);
		for (const key of ["Enter", " "]) {
			expect(fireEvent.keyDown(button, { key })).toBe(true);
			expect(fireEvent.keyUp(button, { key })).toBe(true);
		}
	});

	it("原生 disabled 的行不可聚焦、不触发", () => {
		const onClick = vi.fn();
		render(
			<List aria-label="设置">
				<ListItem onClick={onClick} disabled>
					<ListItemTitle>语言</ListItemTitle>
				</ListItem>
			</List>,
		);
		const button = screen.getByRole("button", { name: "语言" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		fireEvent.click(button);
		expect(onClick).not.toHaveBeenCalled();
	});

	it("button 行的 ref 与 className 落在 button 上，不是 li", () => {
		const ref = createRef<HTMLButtonElement>();
		render(
			<List aria-label="设置">
				<ListItem onClick={() => {}} ref={ref} className="mine" data-testid="r">
					<ListItemTitle>语言</ListItemTitle>
				</ListItem>
			</List>,
		);
		const button = screen.getByRole("button", { name: "语言" });
		expect(ref.current).toBe(button);
		expect(button.classList.contains("mine")).toBe(true);
		expect(button.classList.contains("v-list__row")).toBe(true);
		expect(button.getAttribute("data-testid")).toBe("r");
		expect(button.parentElement?.tagName).toBe("LI");
	});
});

describe("asChild", () => {
	it("链接行：保留子元素的 a 与 href，属性与 ref 合并到它身上，不多包一层", () => {
		const ref = createRef<HTMLElement>();
		const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
		render(
			<List aria-label="导航">
				<ListItem asChild ref={ref} className="mine" onClick={onClick} data-testid="nav">
					<a href="/blog" className="own">
						<ListItemTitle>文章</ListItemTitle>
					</a>
				</ListItem>
			</List>,
		);
		const link = screen.getByRole("link", { name: "文章" });
		expect(link.getAttribute("href")).toBe("/blog");
		expect(ref.current).toBe(link);
		expect(link.getAttribute("data-testid")).toBe("nav");
		for (const name of ["own", "mine", "v-list__row"]) {
			expect(link.classList.contains(name)).toBe(true);
		}
		expect(link.parentElement?.tagName).toBe("LI");
		fireEvent.click(link);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("链接行的 Enter 按下不被取消，可替换成调用方自己的 Link 组件", () => {
		function MyLink({ to, ...props }: { to: string } & ComponentProps<"a">) {
			return <a href={to} data-router="1" {...props} />;
		}
		render(
			<List aria-label="导航">
				<ListItem asChild>
					<MyLink to="/archive">
						<ListItemTitle>归档</ListItemTitle>
					</MyLink>
				</ListItem>
			</List>,
		);
		const link = screen.getByRole("link", { name: "归档" });
		expect(link.getAttribute("href")).toBe("/archive");
		expect(link.getAttribute("data-router")).toBe("1");
		expect(link.classList.contains("v-list__row")).toBe(true);
		expect(fireEvent.keyDown(link, { key: "Enter" })).toBe(true);
	});
});

describe("行里有操作", () => {
	it("没有 onClick 的行不是 button 也不是链接，只有操作是 button 并用调用方给的名称", () => {
		const onMore = vi.fn();
		render(
			<List aria-label="成员">
				<ListItem data-testid="member">
					<ListItemContent>
						<ListItemTitle>小径</ListItemTitle>
					</ListItemContent>
					<ListItemAction aria-label="小径 的更多操作" onClick={onMore}>
						<svg />
					</ListItemAction>
				</ListItem>
			</List>,
		);
		const member = screen.getByTestId("member");
		expect(member.tagName).toBe("DIV");
		expect(screen.getAllByRole("button")).toHaveLength(1);
		expect(screen.queryByRole("link")).toBeNull();
		fireEvent.click(member);
		expect(onMore).not.toHaveBeenCalled();
		const action = screen.getByRole("button", { name: "小径 的更多操作" }) as HTMLButtonElement;
		expect(action.type).toBe("button");
		fireEvent.click(action);
		expect(onMore).toHaveBeenCalledTimes(1);
	});

	it("操作的 ref 与原生属性透传，可作为别的触发器的 asChild 子元素接收属性", () => {
		const ref = createRef<HTMLButtonElement>();
		render(
			<List aria-label="成员">
				<ListItem>
					<ListItemAction
						ref={ref}
						aria-label="下载 cover.webp"
						aria-haspopup="menu"
						className="mine"
					>
						<svg />
					</ListItemAction>
				</ListItem>
			</List>,
		);
		const action = screen.getByRole("button", { name: "下载 cover.webp" });
		expect(ref.current).toBe(action);
		expect(action.getAttribute("aria-haspopup")).toBe("menu");
		expect(action.classList.contains("mine")).toBe(true);
	});

	it("纯展示的行是普通容器，没有任何可交互角色", () => {
		render(
			<List aria-label="文件">
				<ListItem data-testid="plain">
					<ListItemTitle>cover.webp</ListItemTitle>
				</ListItem>
			</List>,
		);
		expect(screen.getByTestId("plain").tagName).toBe("DIV");
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.queryByRole("link")).toBeNull();
	});
});

describe("当前项", () => {
	it("aria-current 落在行元素上，而不是 li；其它行没有", () => {
		render(
			<List aria-label="导航">
				<ListItem onClick={() => {}} aria-current="page">
					<ListItemTitle>文章</ListItemTitle>
				</ListItem>
				<ListItem onClick={() => {}}>
					<ListItemTitle>归档</ListItemTitle>
				</ListItem>
			</List>,
		);
		const current = screen.getByRole("button", { name: "文章" });
		expect(current.getAttribute("aria-current")).toBe("page");
		expect(current.parentElement?.hasAttribute("aria-current")).toBe(false);
		expect(screen.getByRole("button", { name: "归档" }).hasAttribute("aria-current")).toBe(
			false,
		);
	});

	it("也接受 aria-current 的其它取值，链接行同样落在 a 上", () => {
		render(
			<List aria-label="目录">
				<ListItem asChild aria-current="location">
					<a href="#s1">第一节</a>
				</ListItem>
			</List>,
		);
		expect(screen.getByRole("link", { name: "第一节" }).getAttribute("aria-current")).toBe(
			"location",
		);
	});

	it("当前项给高亮滑块作静止位置：没有悬停时滑块停在当前项", () => {
		render(
			<List aria-label="导航">
				<ListItem onClick={() => {}}>
					<ListItemTitle>首页</ListItemTitle>
				</ListItem>
				<ListItem onClick={() => {}} aria-current="page">
					<ListItemTitle>文章</ListItemTitle>
				</ListItem>
			</List>,
		);
		const list = screen.getByRole("list");
		expect(list.getAttribute("data-list-highlight-visible")).toBe("true");
		expect(row("文章").getAttribute("data-highlighted")).toBe("");
		expect(row("首页").hasAttribute("data-highlighted")).toBe(false);
	});

	it("悬停到别的行滑块过去，移出后回到当前项", () => {
		render(
			<List aria-label="导航">
				<ListItem onClick={() => {}}>
					<ListItemTitle>首页</ListItemTitle>
				</ListItem>
				<ListItem onClick={() => {}} aria-current="page">
					<ListItemTitle>文章</ListItemTitle>
				</ListItem>
			</List>,
		);
		const list = screen.getByRole("list");
		hover(row("首页"));
		expect(row("首页").hasAttribute("data-highlighted")).toBe(true);
		expect(row("文章").hasAttribute("data-highlighted")).toBe(false);
		fireEvent.pointerLeave(list);
		expect(row("文章").hasAttribute("data-highlighted")).toBe(true);
		expect(row("首页").hasAttribute("data-highlighted")).toBe(false);
	});

	it("asChild 的子元素自己带的 aria-current 同样让滑块停靠", () => {
		render(
			<List aria-label="导航">
				<ListItem asChild>
					<a href="/a">甲</a>
				</ListItem>
				<ListItem asChild>
					<a href="/b" aria-current="page">
						乙
					</a>
				</ListItem>
			</List>,
		);
		expect(screen.getByRole("link", { name: "乙" }).hasAttribute("data-highlighted")).toBe(
			true,
		);
	});

	it("aria-current 为 false 不算当前项", () => {
		render(
			<List aria-label="导航">
				<ListItem onClick={() => {}} aria-current={false}>
					<ListItemTitle>首页</ListItemTitle>
				</ListItem>
			</List>,
		);
		expect(screen.getByRole("list").hasAttribute("data-list-highlight-visible")).toBe(false);
	});
});

describe("悬停与键盘焦点的高亮", () => {
	const renderLists = () =>
		render(
			<List aria-label="成员">
				<ListItem data-testid="a">
					<ListItemTitle>Rua</ListItemTitle>
				</ListItem>
				<ListItem data-testid="b" onClick={() => {}}>
					<ListItemTitle>小径</ListItemTitle>
				</ListItem>
				<ListItem data-testid="c" onClick={() => {}} disabled>
					<ListItemTitle>南山记</ListItemTitle>
				</ListItem>
			</List>,
		);

	it("悬停的行带 data-highlighted，列表标记滑块可见；换行即换目标", () => {
		renderLists();
		const list = screen.getByRole("list");
		expect(list.hasAttribute("data-list-highlight-visible")).toBe(false);
		hover(screen.getByTestId("a"));
		expect(screen.getByTestId("a").hasAttribute("data-highlighted")).toBe(true);
		expect(list.getAttribute("data-list-highlight-visible")).toBe("true");
		hover(screen.getByTestId("b"));
		expect(screen.getByTestId("a").hasAttribute("data-highlighted")).toBe(false);
		expect(screen.getByTestId("b").hasAttribute("data-highlighted")).toBe(true);
	});

	it("纯展示行与带操作的行也参与悬停高亮", () => {
		renderLists();
		hover(screen.getByTestId("a"));
		expect(screen.getByTestId("a").hasAttribute("data-highlighted")).toBe(true);
	});

	it("第一次出现是淡入，之后换行才是滑动", () => {
		renderLists();
		const list = screen.getByRole("list");
		hover(screen.getByTestId("a"));
		expect(list.getAttribute("data-list-highlight-jump")).toBe("true");
		hover(screen.getByTestId("b"));
		expect(list.getAttribute("data-list-highlight-jump")).toBe("false");
	});

	it("指针离开列表后滑块消失", () => {
		renderLists();
		const list = screen.getByRole("list");
		hover(screen.getByTestId("a"));
		fireEvent.pointerLeave(list);
		expect(screen.getByTestId("a").hasAttribute("data-highlighted")).toBe(false);
		expect(list.getAttribute("data-list-highlight-visible")).toBe("false");
	});

	it("键盘焦点移到行上时高亮跟随，移走后清除", () => {
		// jsdom 没有 :focus-visible 的输入方式判断，这里把焦点当作来自键盘
		const matches = Element.prototype.matches;
		vi.spyOn(Element.prototype, "matches").mockImplementation(function (
			this: Element,
			selector: string,
		) {
			return selector === ":focus-visible"
				? this === document.activeElement
				: matches.call(this, selector);
		});
		renderLists();
		const b = screen.getByTestId("b");
		b.focus();
		expect(b.hasAttribute("data-highlighted")).toBe(true);
		b.blur();
		expect(b.hasAttribute("data-highlighted")).toBe(false);
	});

	it("禁用的行不接管高亮", () => {
		renderLists();
		hover(screen.getByTestId("c"));
		expect(screen.getByTestId("c").hasAttribute("data-highlighted")).toBe(false);
	});
});

describe("服务端渲染", () => {
	it("同步渲染出 ul/li 与行元素，不依赖浏览器 API", () => {
		const html = renderToString(
			<List aria-label="导航" density="compact">
				<ListItem asChild aria-current="page">
					<a href="/blog">
						<ListItemTitle>文章</ListItemTitle>
					</a>
				</ListItem>
			</List>,
		);
		expect(html).toContain("<ul");
		expect(html).toContain("<li");
		expect(html).toContain('aria-current="page"');
		expect(html).toContain('href="/blog"');
	});
});
