import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "../dropdown-menu";

interface FixtureProps {
	onEdit?: () => void;
	onCopy?: () => void;
	onPin?: () => void;
	onSeries?: (name: string) => void;
	onShowChange?: (checked: boolean) => void;
	onSortChange?: (value: string) => void;
	closeOnSelect?: boolean;
	container?: HTMLElement | null;
	modal?: boolean;
}

/** 稿里「我的文章」的操作菜单：普通项、子菜单、不可用项、单选与多选各一。 */
function Fixture({
	onEdit,
	onCopy,
	onPin,
	onSeries,
	onShowChange,
	onSortChange,
	closeOnSelect,
	container,
	modal,
}: FixtureProps) {
	const [sort, setSort] = useState("latest");
	const [summary, setSummary] = useState(true);
	return (
		<>
			<button type="button">外面</button>
			<DropdownMenu modal={modal}>
				<DropdownMenuTrigger>操作</DropdownMenuTrigger>
				<DropdownMenuContent aria-label="文章操作" container={container}>
					<DropdownMenuItem onSelect={onEdit}>
						编辑
						<DropdownMenuShortcut>E</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onCopy}>
						<svg aria-hidden="true" />
						复制链接
						<DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>移动到系列</DropdownMenuSubTrigger>
						<DropdownMenuSubContent aria-label="系列">
							<DropdownMenuItem onSelect={() => onSeries?.("前端")}>
								前端
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => onSeries?.("后端")}>
								后端
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuItem disabled reason="草稿不能置顶" onSelect={onPin}>
						置顶
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>排序</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={sort}
						onValueChange={(value) => {
							setSort(value);
							onSortChange?.(value);
						}}
					>
						<DropdownMenuRadioItem value="latest">最新</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="views">浏览最多</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuCheckboxItem
							checked={summary}
							closeOnSelect={closeOnSelect}
							onCheckedChange={(checked) => {
								setSummary(checked);
								onShowChange?.(checked);
							}}
						>
							显示摘要
						</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">移到回收站</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}

/** 菜单打开时 Radix 把外部内容设为 aria-hidden，触发器要按隐藏元素查。 */
const trigger = () => screen.getByRole("button", { name: "操作", hidden: true });
const menu = () => screen.queryByRole("menu");
const flush = () => act(() => vi.advanceTimersByTime(0));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
/** Radix 用 pointerdown 打开，且只响应鼠标左键。 */
const clickOpen = () => {
	fireEvent.pointerDown(trigger(), { button: 0, ctrlKey: false, pointerType: "mouse" });
	flush();
};
const keyOpen = (key = "ArrowDown") => {
	act(() => trigger().focus());
	fireEvent.keyDown(trigger(), { key });
	flush();
};
const press = (key: string) => {
	fireEvent.keyDown(document.activeElement ?? document.body, { key });
	flush();
};
const item = (name: string | RegExp) => screen.getByRole("menuitem", { name });
const focused = () => document.activeElement;
const mouse = { pointerType: "mouse" } as const;

describe("DropdownMenu", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("读屏契约", () => {
		it("面板是 menu，项按类型是 menuitem / menuitemradio / menuitemcheckbox", () => {
			render(<Fixture />);
			clickOpen();

			expect(menu()?.getAttribute("aria-label")).toBe("文章操作");
			expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toEqual([
				"编辑E",
				"复制链接⌘C",
				"移动到系列",
				"置顶草稿不能置顶",
				"移到回收站",
			]);
			expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
			expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(1);
			expect(screen.getAllByRole("group").length).toBeGreaterThan(0);
		});

		it("单选与多选带 aria-checked，随值变化", () => {
			render(<Fixture />);
			clickOpen();
			const latest = screen.getByRole("menuitemradio", { name: "最新" });
			const views = screen.getByRole("menuitemradio", { name: "浏览最多" });
			const summary = screen.getByRole("menuitemcheckbox", { name: "显示摘要" });
			expect(latest.getAttribute("aria-checked")).toBe("true");
			expect(views.getAttribute("aria-checked")).toBe("false");
			expect(summary.getAttribute("aria-checked")).toBe("true");

			fireEvent.click(views);
			expect(views.getAttribute("aria-checked")).toBe("true");
		});

		it("不可用项带 aria-disabled，并写出原因", () => {
			render(<Fixture />);
			clickOpen();
			const pin = item(/置顶/);
			expect(pin.getAttribute("aria-disabled")).toBe("true");
			expect(pin.textContent).toContain("草稿不能置顶");
		});

		it("触发器标出展开状态", () => {
			render(<Fixture />);
			expect(trigger().getAttribute("aria-expanded")).toBe("false");
			clickOpen();
			expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
			expect(trigger().getAttribute("aria-expanded")).toBe("true");
		});
	});

	describe("打开与关闭", () => {
		it("键盘按 ↓、Enter、空格打开，焦点进第一项", () => {
			for (const key of ["ArrowDown", "Enter", " "]) {
				render(<Fixture />);
				keyOpen(key);
				expect(menu()).not.toBeNull();
				expect(focused()).toBe(item(/^编辑/));
				cleanup();
			}
		});

		it("指针打开时不预先高亮任何项，焦点在面板上", () => {
			render(<Fixture />);
			clickOpen();
			expect(menu()).not.toBeNull();
			expect(focused()).toBe(menu());
			expect(document.querySelector("[data-highlighted]")).toBeNull();
		});

		it("Esc 关闭，焦点回到触发器", () => {
			render(<Fixture />);
			keyOpen();
			press("Escape");
			expect(menu()).toBeNull();
			expect(focused()).toBe(trigger());
		});

		it("点击外部关闭，焦点回到触发器", () => {
			render(<Fixture />);
			clickOpen();
			fireEvent.pointerDown(document.body, mouse);
			flush();
			expect(menu()).toBeNull();
			expect(focused()).toBe(trigger());
		});

		it("非模态菜单点外面落在别的可聚焦元素上时，不抢走它的焦点", () => {
			render(<Fixture modal={false} />);
			clickOpen();
			const outside = screen.getByRole("button", { name: "外面", hidden: true });
			fireEvent.pointerDown(outside, mouse);
			act(() => outside.focus());
			flush();
			expect(menu()).toBeNull();
			expect(focused()).toBe(outside);
		});

		it("再点触发器收起", () => {
			render(<Fixture />);
			clickOpen();
			clickOpen();
			expect(menu()).toBeNull();
		});

		it("Tab 不会把焦点带出面板", () => {
			render(<Fixture />);
			keyOpen();
			const tab = fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
			expect(tab).toBe(false);
			expect(menu()).not.toBeNull();
		});
	});

	describe("键盘导航", () => {
		it("↑↓ 移动并循环，不可用项被跳过", () => {
			render(<Fixture />);
			keyOpen();
			expect(focused()).toBe(item(/^编辑/));
			press("ArrowDown");
			expect(focused()).toBe(item(/^复制链接/));
			press("ArrowDown");
			expect(focused()).toBe(item("移动到系列"));
			// 下一项是不可用的「置顶」，跳到单选项
			press("ArrowDown");
			expect(focused()).toBe(screen.getByRole("menuitemradio", { name: "最新" }));

			press("ArrowUp");
			expect(focused()).toBe(item("移动到系列"));
			press("ArrowUp");
			press("ArrowUp");
			expect(focused()).toBe(item(/^编辑/));
			// 到头再往上回到最后一项
			press("ArrowUp");
			expect(focused()).toBe(item("移到回收站"));
			press("ArrowDown");
			expect(focused()).toBe(item(/^编辑/));
		});

		it("Home / End 到两端", () => {
			render(<Fixture />);
			keyOpen();
			press("End");
			expect(focused()).toBe(item("移到回收站"));
			press("Home");
			expect(focused()).toBe(item(/^编辑/));
		});

		it("Enter 与空格执行当前项并收起", () => {
			const onEdit = vi.fn();
			const onCopy = vi.fn();
			render(<Fixture onEdit={onEdit} onCopy={onCopy} />);
			keyOpen();
			press("Enter");
			expect(onEdit).toHaveBeenCalledTimes(1);
			expect(menu()).toBeNull();

			keyOpen();
			press("ArrowDown");
			press(" ");
			expect(onCopy).toHaveBeenCalledTimes(1);
			expect(menu()).toBeNull();
		});

		it("输入字母跳到拼音首字母相同的项：B 编辑、F 复制链接，大小写不敏感", () => {
			render(<Fixture />);
			keyOpen();
			press("ArrowDown");
			press("ArrowDown");
			expect(focused()).toBe(item("移动到系列"));

			press("b");
			expect(focused()).toBe(item(/^编辑/));
			advance(1000);
			press("F");
			expect(focused()).toBe(item(/^复制链接/));
		});

		it("英文标签仍按原文前缀匹配，同首字母时向后找下一项", () => {
			render(
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>操作</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem>Rename</DropdownMenuItem>
						<DropdownMenuItem>Move to series</DropdownMenuItem>
						<DropdownMenuItem>Move to trash</DropdownMenuItem>
						<DropdownMenuItem>复制链接</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>,
			);
			flush();
			act(() => screen.getByRole("menuitem", { name: "Rename" }).focus());
			press("m");
			expect(focused()).toBe(screen.getByRole("menuitem", { name: "Move to series" }));
			advance(1000);
			press("m");
			expect(focused()).toBe(screen.getByRole("menuitem", { name: "Move to trash" }));
			advance(1000);
			press("f");
			expect(focused()).toBe(screen.getByRole("menuitem", { name: "复制链接" }));
		});

		it("不可用项不参与字母跳转", () => {
			render(<Fixture />);
			keyOpen();
			// 「置顶」(zd) 不可用：z 先落在「最新」(zx)，接着输入 d 没有 zd 可匹配，焦点不会跳到不可用项
			press("z");
			expect(focused()).toBe(screen.getByRole("menuitemradio", { name: "最新" }));
			press("d");
			expect(focused()).not.toBe(item(/置顶/));
			expect(focused()).toBe(screen.getByRole("menuitemradio", { name: "最新" }));
		});

		it("自带 textValue 时以它为准", () => {
			render(
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>操作</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem>编辑</DropdownMenuItem>
						<DropdownMenuItem textValue="shortcut">
							<span>复制</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>,
			);
			flush();
			act(() => screen.getByRole("menuitem", { name: "编辑" }).focus());
			press("s");
			expect(focused()).toBe(screen.getByRole("menuitem", { name: "复制" }));
		});
	});

	describe("执行与收起", () => {
		it("普通项执行后收起，焦点回到触发器", () => {
			const onEdit = vi.fn();
			render(<Fixture onEdit={onEdit} />);
			clickOpen();
			fireEvent.click(item(/^编辑/));
			flush();
			expect(onEdit).toHaveBeenCalledTimes(1);
			expect(menu()).toBeNull();
			expect(focused()).toBe(trigger());
		});

		it("不可用项点了没有反应，菜单仍开着", () => {
			const onPin = vi.fn();
			render(<Fixture onPin={onPin} />);
			clickOpen();
			fireEvent.click(item(/置顶/));
			expect(onPin).not.toHaveBeenCalled();
			expect(menu()).not.toBeNull();
		});

		it("单选项选中后收起并带出新值", () => {
			const onSortChange = vi.fn();
			render(<Fixture onSortChange={onSortChange} />);
			clickOpen();
			fireEvent.click(screen.getByRole("menuitemradio", { name: "浏览最多" }));
			expect(onSortChange).toHaveBeenCalledWith("views");
			expect(menu()).toBeNull();
		});

		it("多选项点了不收起，可以连着改", () => {
			const onShowChange = vi.fn();
			render(<Fixture onShowChange={onShowChange} />);
			clickOpen();
			const summary = screen.getByRole("menuitemcheckbox", { name: "显示摘要" });
			fireEvent.click(summary);
			expect(onShowChange).toHaveBeenLastCalledWith(false);
			expect(menu()).not.toBeNull();
			expect(summary.getAttribute("aria-checked")).toBe("false");

			fireEvent.click(summary);
			expect(onShowChange).toHaveBeenLastCalledWith(true);
			expect(summary.getAttribute("aria-checked")).toBe("true");
			expect(menu()).not.toBeNull();
		});

		it("多选项传 closeOnSelect 时选中后收起", () => {
			render(<Fixture closeOnSelect />);
			clickOpen();
			fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "显示摘要" }));
			expect(menu()).toBeNull();
		});

		it("键盘在多选项上按空格同样不收起", () => {
			render(<Fixture />);
			keyOpen();
			act(() => screen.getByRole("menuitemcheckbox", { name: "显示摘要" }).focus());
			press(" ");
			expect(menu()).not.toBeNull();
			expect(
				screen
					.getByRole("menuitemcheckbox", { name: "显示摘要" })
					.getAttribute("aria-checked"),
			).toBe("false");
		});
	});

	describe("子菜单", () => {
		const subTrigger = () => item("移动到系列");
		// Radix 以触发项命名子菜单（aria-labelledby 优先于 aria-label）
		const subMenu = () => screen.queryByRole("menu", { name: "移动到系列" });

		it("指针悬停 100ms 打开", () => {
			render(<Fixture />);
			clickOpen();
			fireEvent.pointerMove(subTrigger(), mouse);
			advance(99);
			expect(subMenu()).toBeNull();
			advance(1);
			expect(subMenu()).not.toBeNull();
			expect(subTrigger().getAttribute("aria-expanded")).toBe("true");
		});

		it("指针在 100ms 内移开则不打开", () => {
			render(<Fixture />);
			clickOpen();
			fireEvent.pointerMove(subTrigger(), mouse);
			advance(60);
			fireEvent.pointerLeave(subTrigger(), mouse);
			advance(200);
			expect(subMenu()).toBeNull();
		});

		it("焦点在触发项上按 → 打开并进入子菜单，← 只收起子菜单并回到触发项", () => {
			render(<Fixture />);
			keyOpen();
			act(() => subTrigger().focus());
			press("ArrowRight");
			expect(subMenu()).not.toBeNull();
			expect(subMenu()?.contains(focused())).toBe(true);

			press("ArrowLeft");
			expect(subMenu()).toBeNull();
			expect(menu()).not.toBeNull();
			expect(focused()).toBe(subTrigger());
		});

		it("Esc 只收起子菜单，焦点回到触发项；再按 Esc 才关整个菜单", () => {
			render(<Fixture />);
			keyOpen();
			act(() => subTrigger().focus());
			press("ArrowRight");
			expect(subMenu()).not.toBeNull();

			press("Escape");
			expect(subMenu()).toBeNull();
			expect(menu()).not.toBeNull();
			expect(focused()).toBe(subTrigger());

			press("Escape");
			expect(menu()).toBeNull();
			expect(focused()).toBe(trigger());
		});

		it("选了子菜单里的项，整个菜单一起收起", () => {
			const onSeries = vi.fn();
			render(<Fixture onSeries={onSeries} />);
			clickOpen();
			fireEvent.pointerMove(subTrigger(), mouse);
			advance(100);
			fireEvent.click(screen.getByRole("menuitem", { name: "后端" }));
			expect(onSeries).toHaveBeenCalledWith("后端");
			expect(menu()).toBeNull();
			expect(subMenu()).toBeNull();
		});

		describe("斜着移向子菜单", () => {
			/** jsdom 没有布局：给子菜单一块位置，Radix 才能算出朝向它的宽限区域。 */
			const placeSubMenu = () => {
				const rect = new DOMRect(300, 0, 200, 200);
				vi.spyOn(subMenu() as HTMLElement, "getBoundingClientRect").mockReturnValue(rect);
			};

			const openAndLeaveTowardSub = () => {
				render(<Fixture />);
				clickOpen();
				fireEvent.pointerMove(subTrigger(), { ...mouse, clientX: 100, clientY: 50 });
				advance(100);
				placeSubMenu();
				fireEvent.pointerLeave(subTrigger(), { ...mouse, clientX: 100, clientY: 50 });
			};

			it("离开触发项 120ms 内，路过别的项不收起子菜单", () => {
				openAndLeaveTowardSub();
				advance(60);
				fireEvent.pointerMove(item("移到回收站"), { ...mouse, clientX: 150, clientY: 60 });
				advance(30);
				expect(subMenu()).not.toBeNull();
				expect(focused()).toBe(subTrigger());
			});

			it("超过 120ms 后移到别的项才收起子菜单", () => {
				openAndLeaveTowardSub();
				advance(121);
				fireEvent.pointerMove(item("移到回收站"), { ...mouse, clientX: 160, clientY: 60 });
				flush();
				expect(subMenu()).toBeNull();
				expect(menu()).not.toBeNull();
				expect(focused()).toBe(item("移到回收站"));
			});

			it("指针重新回到触发项会重新计宽限", () => {
				openAndLeaveTowardSub();
				advance(121);
				fireEvent.pointerMove(subTrigger(), { ...mouse, clientX: 100, clientY: 50 });
				fireEvent.pointerLeave(subTrigger(), { ...mouse, clientX: 100, clientY: 50 });
				advance(60);
				fireEvent.pointerMove(item("移到回收站"), { ...mouse, clientX: 150, clientY: 60 });
				expect(subMenu()).not.toBeNull();
			});
		});
	});

	describe("挂载容器", () => {
		it("container 把面板与子菜单挂进指定元素", () => {
			const host = document.createElement("div");
			document.body.append(host);
			render(<Fixture container={host} />);
			clickOpen();
			expect(host.contains(menu())).toBe(true);

			fireEvent.pointerMove(item("移动到系列"), mouse);
			advance(100);
			expect(host.contains(screen.getByRole("menu", { name: "移动到系列" }))).toBe(true);
			host.remove();
		});

		it("不传 container 时挂到 body", () => {
			render(<Fixture />);
			clickOpen();
			expect(menu()?.parentElement?.parentElement).toBe(document.body);
		});
	});

	describe("DOM 契约", () => {
		it("透传 className 与 ref，data-variant 区分危险项", () => {
			const ref = createRef<HTMLDivElement>();
			render(
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>操作</DropdownMenuTrigger>
					<DropdownMenuContent ref={ref} className="custom">
						<DropdownMenuItem variant="destructive" inset>
							删除
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>,
			);
			expect(ref.current).toBe(menu());
			expect(menu()?.classList.contains("custom")).toBe(true);
			const danger = screen.getByRole("menuitem", { name: "删除" });
			expect(danger.getAttribute("data-variant")).toBe("destructive");
			expect(danger.hasAttribute("data-inset")).toBe(true);
		});

		it("onOpenAutoFocus 阻止默认后，面板不接管焦点", () => {
			render(
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>操作</DropdownMenuTrigger>
					<DropdownMenuContent onOpenAutoFocus={(event) => event.preventDefault()}>
						<DropdownMenuItem>编辑</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>,
			);
			flush();
			expect(menu()).not.toBeNull();
			expect(focused()).not.toBe(menu());
		});

		it("asChild 的项把项样式与角色落在子元素上", () => {
			render(
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>操作</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem asChild>
							<a href="/profile">个人中心</a>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>,
			);
			const link = screen.getByRole("menuitem", { name: "个人中心" });
			expect(link.tagName).toBe("A");
			expect(link.classList.contains("v-dropdown-menu__item")).toBe(true);
		});

		it("服务端渲染不输出面板", () => {
			const html = renderToString(<Fixture />);
			expect(html).toContain("操作");
			expect(html).not.toContain('role="menu"');
		});
	});
});
