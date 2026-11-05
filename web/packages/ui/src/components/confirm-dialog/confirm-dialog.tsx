import { CircleAlert } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "../button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../dialog";
import { Input } from "../input";

/** 不可逆操作前的一次确认：标题写后果，按钮写动作本身。 */
export interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 直接写后果和对象，以问号结尾，如「永久删除「独库公路，六天」？」 */
	title: ReactNode;
	/** 一句话写影响范围：还会连带什么、能不能恢复 */
	description?: ReactNode;
	/**
	 * 动作本身，如「永久删除」「撤销授权」，不写「确定」。
	 * @default "确认"
	 */
	confirmLabel?: string;
	/** @default "取消" */
	cancelLabel?: string;
	/** 执行中：动作按钮转圈并换成 loadingLabel，取消与 Esc 暂时不可用 */
	loading?: boolean;
	/** @default `正在${confirmLabel}…` */
	loadingLabel?: ReactNode;
	/** 失败的原因与现状；出现时对话框不关，按钮恢复，可以直接重试 */
	error?: ReactNode;
	/** 影响很大的操作：输入这段文字后动作按钮才可用 */
	confirmText?: string;
	/**
	 * 动作用危险色实底。
	 * @default true
	 */
	destructive?: boolean;
	onConfirm: () => void;
	/** 挂载 Portal 的容器；默认 `document.body` */
	container?: HTMLElement | null;
}

/**
 * 确认框：外壳与出场同对话框，没有关闭按钮；点遮罩不关闭，只把焦点移回「取消」并提示一句；Esc 与「取消」等价。
 * 打开时焦点落到「取消」，需要输入名称时落到输入框。
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "确认",
	cancelLabel = "取消",
	loading = false,
	loadingLabel = `正在${confirmLabel}…`,
	error,
	confirmText,
	destructive = true,
	onConfirm,
	container,
}: ConfirmDialogProps) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [typed, setTyped] = useState("");
	const [nudged, setNudged] = useState(false);
	const matched = confirmText === undefined || typed === confirmText;
	// Radix 的 Esc 处理器可能拿到上一次渲染的闭包，执行中状态从 ref 读
	const loadingRef = useRef(loading);
	loadingRef.current = loading;

	const changeOpen = (next: boolean) => {
		if (loadingRef.current) return;
		if (!next) {
			setTyped("");
			setNudged(false);
		}
		onOpenChange(next);
	};

	const confirm = () => {
		if (!matched || loading) return;
		onConfirm();
	};

	return (
		<Dialog open={open} onOpenChange={changeOpen}>
			<DialogContent
				role="alertdialog"
				data-slot="confirm-dialog"
				className="v-confirm"
				showCloseButton={false}
				container={container}
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					(inputRef.current ?? cancelRef.current)?.focus({ preventScroll: true });
				}}
				onEscapeKeyDown={(event) => {
					if (loadingRef.current) event.preventDefault();
				}}
				onPointerDownOutside={(event) => {
					// 它要你做一个选择：点遮罩只把焦点移回「取消」
					event.preventDefault();
					setNudged(true);
					if (!loadingRef.current) cancelRef.current?.focus({ preventScroll: true });
				}}
				onInteractOutside={(event) => event.preventDefault()}
				{...(description ? {} : { "aria-describedby": undefined })}
			>
				<DialogTitle className="v-confirm__title">{title}</DialogTitle>
				{description && (
					<DialogDescription className="v-confirm__description">
						{description}
					</DialogDescription>
				)}
				{confirmText !== undefined && (
					<Input
						ref={inputRef}
						label={
							<>
								输入 <b>{confirmText}</b> 继续
							</>
						}
						classNames={{ root: "v-confirm__field" }}
						value={typed}
						autoComplete="off"
						spellCheck={false}
						disabled={loading}
						onChange={(event) => setTyped(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								confirm();
							}
						}}
					/>
				)}
				{error && (
					<div role="alert" className="v-confirm__error">
						<CircleAlert aria-hidden="true" />
						<span>{error}</span>
					</div>
				)}
				<div className="v-confirm__actions">
					<DialogClose asChild>
						<Button
							ref={cancelRef}
							variant="secondary"
							disabled={loading}
							data-nudged={nudged || undefined}
						>
							{cancelLabel}
						</Button>
					</DialogClose>
					<Button
						variant={destructive ? "destructive" : "primary"}
						loading={loading}
						loadingText={loadingLabel}
						aria-disabled={!matched || undefined}
						onClick={confirm}
					>
						{confirmLabel}
					</Button>
				</div>
				{nudged && (
					<p className="v-confirm__hint">点遮罩不会关闭，按 Esc 或点「{cancelLabel}」</p>
				)}
			</DialogContent>
		</Dialog>
	);
}
