/**
 * CommentSection - 文章底部自由评论区容器
 *
 * PRD-0001 双轨制 + 黑洞模式：
 *   - 登录态：渲染 CommentForm（直发）+ CommentList（看到 approved ∪ 自己 pending）
 *   - 匿名态：渲染「登录后查看 N 条评论」引导 + CommentForm（两步流）；
 *     不渲染评论列表（后端黑洞模式返回空，前端不展示空 Empty）
 *
 * 数据流：useComments(postId) 拉评论，useMe() 判定登录态。
 */

import { useMe } from "@features/auth/api/queries";
import { useLoginDialogStore } from "@features/auth/model/login-dialog-store";
import { useComments } from "@features/comments/api/queries";
import { Button } from "@shared/ui/base/button";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { LogIn, MessageSquare } from "lucide-react";
import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";

export interface CommentSectionProps {
    /** 文章 id */
    postId: string;
}

export function CommentSection({ postId }: CommentSectionProps) {
    const me = useMe();
    const isLoggedIn = !!me.data;
    const { data, isLoading } = useComments(postId);
    const openLogin = useLoginDialogStore((s) => s.open);

    const comments = data?.data ?? [];

    // 容器由父组件（$slug.tsx）控制：评论区作为正文+TOC flex 容器的子项，
    // 用 min-w-0 max-w-3xl flex-1 与 <main> 同宽同位置（含大屏 TOC 偏移）。
    return (
        <section className="min-w-0 max-w-3xl flex-1" aria-label="评论区">
            <header className="mb-6 flex items-center gap-2">
                <MessageSquare className="size-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">
                    {isLoggedIn ? `评论 (${comments.length})` : "评论"}
                </h2>
            </header>

            {/* 匿名黑洞引导：未登录时显示登录 CTA，不展示评论列表 */}
            {!isLoggedIn && (
                <div className="mb-6 flex items-center justify-between rounded-lg border border-edge-hairline bg-muted/30 px-4 py-3">
                    <p className="text-sm text-muted-foreground">登录后查看评论并参与完整讨论</p>
                    <Button variant="outline" size="sm" onClick={() => openLogin()}>
                        <LogIn className="size-4" />
                        登录
                    </Button>
                </div>
            )}

            {/* 评论输入：双模式（登录直发 / 匿名两步流） */}
            <div className="mb-8">
                <CommentForm postId={postId} isLoggedIn={isLoggedIn} />
            </div>

            {/* 评论列表：仅登录态渲染（匿名黑洞看不到） */}
            {isLoggedIn ? (
                isLoading ? (
                    <div className="space-y-3">
                        <ShimmerSkeleton className="h-24 w-full rounded-xl" />
                        <ShimmerSkeleton className="h-24 w-full rounded-xl" />
                    </div>
                ) : (
                    <CommentList comments={comments} />
                )
            ) : null}
        </section>
    );
}

export default CommentSection;
