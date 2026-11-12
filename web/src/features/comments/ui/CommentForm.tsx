/** 登录用户直接评论；匿名用户先发送邮箱验证码，再随评论一起提交。 */

import { useCreateComment, useSendCommentCode } from "@features/comments/api/mutations";
import type { Comment, CreateComment } from "@features/comments/model/types";
import { ApiError } from "@shared/api/error";
import type { PictureInput } from "@shared/ui/rich-text-input/RichTextInput";
import { Button, Field, Input, InputOTP, iconProps, ResendButton, Spinner } from "@violet/ui";
import { MailCheck, Send } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { RichCommentInput } from "./RichCommentInput";

export interface CommentFormProps {
	/** 文章 id */
	postId: string;
	/** 父评论 id（回复模式）；顶级评论省略 */
	parentId?: string;
	/** 当前是否登录（决定走登录直发还是匿名两步流） */
	isLoggedIn: boolean;
	/** 紧凑模式（回复框）；默认 false（顶级评论） */
	compact?: boolean;
	/**
	 * 输入布局：field 把输入收进组件库字段，图标钮与文字同行，用于批注卡内的回复。
	 *
	 * @default "stacked"
	 */
	layout?: "stacked" | "field";
	/** 是否允许上传图片；默认 true */
	enableImage?: boolean;
	/** 提交成功回调，参数为后端返回的新评论对象 */
	onSuccess?: (comment: Comment) => void;
}

export function CommentForm({
	postId,
	parentId,
	isLoggedIn,
	compact = false,
	layout = "stacked",
	enableImage = true,
	onSuccess,
}: CommentFormProps) {
	// 共享字段
	const [body, setBody] = useState("");
	const [pictures, setPictures] = useState<PictureInput[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [resetNonce, setResetNonce] = useState(0);
	// ⌘/Ctrl+Enter 经提交按钮 click()：按钮禁用时不触发，并保留原生 required 校验
	const submitRef = useRef<HTMLButtonElement>(null);
	// 匿名字段
	const [authorName, setAuthorName] = useState("");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [codeError, setCodeError] = useState("");
	const [invalidCode, setInvalidCode] = useState(false);
	const codeSession = useRef(0);

	const sendCode = useSendCommentCode(postId);
	const createComment = useCreateComment(postId);

	/** 匿名发码。返回 false 表示未生效（ResendButton 不进入冷却）。 */
	const handleSendCode = async (): Promise<boolean> => {
		if (!email.trim()) {
			toast.error("请先填写邮箱");
			return false;
		}
		const session = codeSession.current;
		try {
			await sendCode.mutateAsync({ email: email.trim() });
			if (session !== codeSession.current) return false;
			setCode("");
			setCodeError("");
			setInvalidCode(false);
			setCodeSent(true);
			toast.success("验证码已发送至邮箱");
			return true;
		} catch (err) {
			if (session !== codeSession.current) return false;
			toastError(err, "发送验证码失败");
			return false;
		}
	};

	/** 提交评论 */
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!body.trim()) {
			toast.error("评论内容不能为空");
			return;
		}
		const payload: CreateComment = { body: body.trim(), parent_id: parentId };
		if (pictures.length > 0) {
			payload.pictures = pictures;
		}
		if (!isLoggedIn) {
			payload.author_name = authorName.trim();
			payload.author_email = email.trim();
			payload.code = code.trim();
		}
		const session = codeSession.current;
		createComment.mutate(payload, {
			onSuccess: (newComment) => {
				if (newComment.status === "pending") {
					toast.success(
						isLoggedIn ? "已提交，等待审核" : "已提交，管理员审核通过后登录可见",
					);
				} else if (!isLoggedIn) {
					toast.success("已提交，登录后可见");
				}
				setBody("");
				setPictures([]);
				setResetNonce((n) => n + 1);
				setAuthorName("");
				setEmail("");
				codeSession.current += 1;
				setCodeError("");
				setInvalidCode(false);
				setCode("");
				setCodeSent(false);
				onSuccess?.(newComment);
			},
			onError: (err) => {
				if (
					!isLoggedIn &&
					session === codeSession.current &&
					err instanceof ApiError &&
					err.code === "BAD_REQUEST" &&
					err.message === "验证码错误或已过期"
				) {
					setCodeError(err.message);
					setInvalidCode(true);
				}
				toastError(err, "提交失败");
			},
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			{/* 匿名两步流：昵称 + 邮箱 + 验证码 */}
			{!isLoggedIn && (
				<div className="space-y-2">
					<div className="grid gap-2 sm:grid-cols-2">
						<Input
							aria-label="昵称"
							placeholder="昵称 *"
							value={authorName}
							onChange={(e) => setAuthorName(e.target.value)}
							required
						/>
						<div className="flex gap-2">
							<Input
								type="email"
								aria-label="邮箱"
								classNames={{ control: "min-w-0 flex-1" }}
								placeholder="邮箱 *"
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									codeSession.current += 1;
									setCodeSent(false);
									setCode("");
									setCodeError("");
									setInvalidCode(false);
								}}
								required
							/>
							<ResendButton
								onResend={handleSendCode}
								resetKey={email}
								disabled={createComment.isPending}
								label={codeSent ? "重新发送" : "发送验证码"}
							/>
						</div>
					</div>
					{codeSent && (
						<div className="flex flex-col items-center gap-2">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<MailCheck className="size-4" />
								验证码已发送至 {email}
							</div>
							<Field label="邮箱验证码" error={codeError}>
								<InputOTP
									name="code"
									value={code}
									onChange={(value) => {
										setCode(value);
										setInvalidCode(false);
										if (value) setCodeError("");
									}}
									invalid={invalidCode && !createComment.isPending}
									disabled={createComment.isPending}
									required
								/>
							</Field>
						</div>
					)}
				</div>
			)}

			{/* 共享：评论内容输入 */}
			<RichCommentInput
				value={body}
				onChange={setBody}
				compact={compact}
				layout={layout}
				disabled={createComment.isPending}
				enableImage={isLoggedIn && enableImage}
				maxImages={10}
				resetNonce={resetNonce}
				onImagesChange={setPictures}
				onUploadingChange={setIsUploading}
				onSubmit={() => submitRef.current?.click()}
				placeholder={isLoggedIn ? "写下你的评论…" : "写下你的留言（登录后可见他人评论）…"}
				toolbarEnd={
					<>
						{!isLoggedIn && (
							<span className="mr-auto text-xs text-muted-foreground">
								匿名留言需邮箱验证码，审核通过后登录可见
							</span>
						)}
						{layout === "field" ? (
							<Button
								ref={submitRef}
								type="submit"
								variant={body.trim() ? "primary" : "ghost"}
								size="sm"
								iconOnly
								aria-label="发送"
								loading={createComment.isPending}
								disabled={
									!body.trim() ||
									isUploading ||
									(!isLoggedIn && (!codeSent || code.length !== 6))
								}
							>
								<Send />
							</Button>
						) : (
							<button
								ref={submitRef}
								type="submit"
								disabled={
									createComment.isPending ||
									isUploading ||
									(!isLoggedIn && (!codeSent || code.length !== 6))
								}
								title="发送"
								aria-label="发送"
								className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
							>
								{createComment.isPending ? (
									<Spinner size={16} aria-hidden="true" />
								) : (
									<Send {...iconProps(14)} />
								)}
							</button>
						)}
					</>
				}
			/>
		</form>
	);
}

/** 错误 → toast：把 ApiError 的 message 暴露给用户 */
function toastError(err: unknown, fallback: string) {
	if (err instanceof ApiError) {
		toast.error(err.message || fallback);
		return;
	}
	toast.error(fallback);
}

export default CommentForm;
