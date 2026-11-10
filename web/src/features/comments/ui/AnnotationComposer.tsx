import { InlineLogin } from "@features/auth/ui/InlineLogin";
import { Button } from "@violet/ui";
import { Send } from "lucide-react";
import { useState } from "react";
import { RichCommentInput } from "./RichCommentInput";

export interface AnnotationComposerProps {
	body: string;
	onBodyChange: (value: string) => void;
	onSubmit: () => void;
	pending: boolean;
	placeholder: string;
	/** 输入区的可访问名称，如「批注内容」「段评内容」 */
	editorLabel: string;
	/** 发送钮的可访问名称；未登录时固定为「登录并发送」 */
	sendLabel: string;
	/** 未登录：照常写内容，点「登录并发送」在卡片内展开登录区，登录成功后调用 onLoggedIn */
	loginRequired?: boolean;
	/** 在卡片内登录成功后调用，调用方此时应直接发送批注（会话已建立） */
	onLoggedIn?: () => void;
	autoFocus?: boolean;
}

/** 批注卡底部的输入：可添加表情，回车或点发送提交，Shift+回车换行。 */
export function AnnotationComposer({
	body,
	onBodyChange,
	onSubmit,
	pending,
	placeholder,
	editorLabel,
	sendLabel,
	loginRequired = false,
	onLoggedIn,
	autoFocus = false,
}: AnnotationComposerProps) {
	const [showLogin, setShowLogin] = useState(false);
	const empty = !body.trim();
	const submit = () => {
		if (pending || empty) return;
		if (loginRequired) setShowLogin(true);
		else onSubmit();
	};
	return (
		<div className="annotation-composer">
			<RichCommentInput
				value={body}
				onChange={onBodyChange}
				onSubmit={submit}
				submitOnEnter
				enableEmoji
				enableImage={false}
				compact
				autoFocus={autoFocus}
				disabled={pending}
				placeholder={placeholder}
				editorLabel={editorLabel}
				toolbarEnd={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						iconOnly
						aria-label={loginRequired ? "登录并发送" : sendLabel}
						loading={pending}
						disabled={empty}
						onClick={submit}
					>
						<Send />
					</Button>
				}
			/>
			{loginRequired && showLogin && (
				<InlineLogin
					className="annotation-pop mt-3"
					description="登录后即可发送你的批注，内容已为你保留。"
					onSuccess={() => onLoggedIn?.()}
				/>
			)}
		</div>
	);
}
