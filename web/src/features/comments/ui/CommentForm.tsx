/**
 * CommentForm - 评论输入表单（双模式）
 *
 * PRD-0001 双轨认证：
 *   - 登录态（isLoggedIn=true）：单步直发，作者信息从会话取（前端不传 author_*），
 *     提交成功后立即看到自己 pending 评论 + 「审批中」徽章。
 *   - 匿名态（isLoggedIn=false）：两步流
 *       1. 填昵称 + 邮箱 → 点「发送验证码」（useSendCommentCode）
 *       2. 收到邮箱 6 位码 → 用 InputOTP 收码 + 填评论内容 → 提交（带 code）
 *     提交成功后 toast（黑洞模式看不到自己刚提交的）。
 *     验证码错误 → 400；同一文章已留过言 → 409，均由 toast 反馈。
 *
 * 复用：InputOTP + ResendButton（匿名验证码两步流核心 UI 已就位）。
 */

import { useLoginDialogStore } from "@features/auth/model/login-dialog-store";
import { useCreateComment, useSendCommentCode } from "@features/comments/api/mutations";
import type { Comment, CreateComment } from "@features/comments/model/types";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@shared/ui/otp";
import { ResendButton } from "@shared/ui/resend-button";
import { Loader2, LogIn, MailCheck, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type PictureInput, RichCommentInput } from "./RichCommentInput";

export interface CommentFormProps {
    /** 文章 id */
    postId: string;
    /** 父评论 id（回复模式）；顶级评论省略 */
    parentId?: string;
    /** 当前是否登录（决定走登录直发还是匿名两步流） */
    isLoggedIn: boolean;
    /** 紧凑模式（回复框）；默认 false（顶级评论） */
    compact?: boolean;
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
    enableImage = true,
    onSuccess,
}: CommentFormProps) {
    // 共享字段
    const [body, setBody] = useState("");
    const [pictures, setPictures] = useState<PictureInput[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [resetNonce, setResetNonce] = useState(0);
    // 匿名字段
    const [authorName, setAuthorName] = useState("");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [codeSent, setCodeSent] = useState(false);

    const openLogin = useLoginDialogStore((s) => s.open);
    const sendCode = useSendCommentCode(postId);
    const createComment = useCreateComment(postId);

    /** 匿名发码。返回 false 表示未生效（ResendButton 不进入冷却）。 */
    const handleSendCode = async (): Promise<boolean> => {
        if (!email.trim()) {
            toast.error("请先填写邮箱");
            return false;
        }
        try {
            await sendCode.mutateAsync({ email: email.trim() });
            setCodeSent(true);
            toast.success("验证码已发送至邮箱");
            return true;
        } catch (err) {
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
        createComment.mutate(payload, {
            onSuccess: (newComment) => {
                if (!isLoggedIn) {
                    toast.success("已提交，管理员审核通过后登录可见");
                }
                setBody("");
                setPictures([]);
                setResetNonce((n) => n + 1);
                setAuthorName("");
                setEmail("");
                setCode("");
                setCodeSent(false);
                onSuccess?.(newComment);
            },
            onError: (err) => toastError(err, "提交失败"),
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className={`space-y-3 ${compact ? "" : "rounded-xl border border-edge-hairline p-4"}`}
        >
            {/* 匿名两步流：昵称 + 邮箱 + 验证码 */}
            {!isLoggedIn && (
                <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                            placeholder="昵称 *"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            required
                        />
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder="邮箱 *"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (codeSent) setCodeSent(false); // 换邮箱重置发码状态
                                }}
                                required
                            />
                            <ResendButton
                                onResend={handleSendCode}
                                resetKey={email}
                                disabled={sendCode.isPending}
                                label={
                                    sendCode.isPending
                                        ? "发送中…"
                                        : codeSent
                                          ? "重新发送"
                                          : "发送验证码"
                                }
                            />
                        </div>
                    </div>
                    {codeSent && (
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MailCheck className="size-4" />
                                验证码已发送至 {email}
                            </div>
                            <InputOTP maxLength={6} value={code} onChange={setCode}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    )}
                </div>
            )}

            {/* 共享：评论内容输入 */}
            <RichCommentInput
                value={body}
                onChange={setBody}
                compact={compact}
                disabled={createComment.isPending}
                enableImage={isLoggedIn && enableImage}
                maxImages={10}
                resetNonce={resetNonce}
                onImagesChange={setPictures}
                onUploadingChange={setIsUploading}
                placeholder={isLoggedIn ? "写下你的评论…" : "写下你的留言（登录后可见他人评论）…"}
                toolbarEnd={
                    <>
                        {!isLoggedIn && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="px-0 text-muted-foreground"
                                onClick={() => openLogin()}
                            >
                                <LogIn className="size-3" />
                                登录参与完整讨论
                            </Button>
                        )}
                        <button
                            type="submit"
                            disabled={
                                createComment.isPending ||
                                isUploading ||
                                (!isLoggedIn && (!codeSent || code.length !== 6))
                            }
                            title="发送"
                            aria-label="发送"
                            className="inline-flex size-7 items-center justify-center rounded bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {createComment.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <Send className="size-3.5" />
                            )}
                        </button>
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
