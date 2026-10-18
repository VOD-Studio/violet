import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface MoveMenuProps {
	/** 菜单按钮与菜单的可访问名称。 */
	label: string;
	/** 菜单按钮上显示的文字。 */
	triggerText: string;
	/** 可选的目标列。 */
	targets: ReadonlyArray<{ id: string; title: string }>;
	/** `hover` 在悬停或聚焦卡片时显示，`always` 常显。 */
	mode: "hover" | "always";
	onSelect(columnId: string): void;
}

/**
 * 「移到…」菜单：按钮加 `role="menu"` 的弹层。
 *
 * 不用原生选择器：Windows 与 Linux 的浏览器里，焦点在关闭的选择器上按方向键就会立刻触发 change，
 * 键盘用户一按方向键卡片就被移走了。这里用 Enter、空格或点击才会选中。
 */
export function MoveMenu({ label, triggerText, targets, mode, onSelect }: MoveMenuProps) {
	const [open, setOpen] = useState(false);
	const menuId = useId();
	const toolsRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	// 打开后：在触发按钮下方（放不下则上方）定位，并把焦点放到第一项
	useLayoutEffect(() => {
		const menu = menuRef.current;
		const trigger = triggerRef.current;
		if (!open || !menu || !trigger) return;
		// fixed 定位不受滚动层裁剪；先放在 0,0 量出祖先 transform 造成的偏差
		menu.style.left = "0px";
		menu.style.top = "0px";
		const origin = menu.getBoundingClientRect();
		const anchor = trigger.getBoundingClientRect();
		const margin = 4;
		const left = Math.min(
			Math.max(anchor.right - origin.width, margin),
			window.innerWidth - origin.width - margin,
		);
		const below = anchor.bottom + margin;
		const top =
			below + origin.height > window.innerHeight
				? anchor.top - origin.height - margin
				: below;
		menu.style.left = `${left - origin.left}px`;
		menu.style.top = `${top - origin.top}px`;
		menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
	}, [open]);

	// 点击菜单之外关闭
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (!toolsRef.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => document.removeEventListener("pointerdown", onPointerDown, true);
	}, [open]);

	const close = (refocus: boolean) => {
		setOpen(false);
		if (refocus) triggerRef.current?.focus();
	};

	const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
		const at = items.indexOf(document.activeElement as HTMLElement);
		const move = (index: number) => {
			event.preventDefault();
			items[(index + items.length) % items.length]?.focus();
		};
		if (event.key === "ArrowDown") move(at + 1);
		else if (event.key === "ArrowUp") move(at - 1);
		else if (event.key === "Home") move(0);
		else if (event.key === "End") move(items.length - 1);
		else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			close(true);
		} else if (event.key === "Tab") close(false);
	};

	return (
		// 指针按下菜单不应开始拖拽卡片
		<div ref={toolsRef} className="v-kanban__card-tools" data-menu={mode} data-kanban-no-drag>
			<button
				ref={triggerRef}
				type="button"
				className="v-kanban__move"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				aria-label={label}
				onClick={() => setOpen((value) => !value)}
				onKeyDown={(event) => {
					if (event.key !== "ArrowDown") return;
					event.preventDefault();
					setOpen(true);
				}}
			>
				{triggerText}
			</button>
			{open ? (
				<div
					ref={menuRef}
					id={menuId}
					role="menu"
					aria-label={label}
					className="v-kanban__menu"
					onKeyDown={onMenuKeyDown}
				>
					{targets.map((target) => (
						<button
							key={target.id}
							type="button"
							role="menuitem"
							tabIndex={-1}
							className="v-kanban__menu-item"
							onClick={() => {
								close(false);
								onSelect(target.id);
							}}
						>
							{target.title}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
