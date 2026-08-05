import { PageShell } from "@features/admin-layout/ui/PageShell";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { type FormEventHandler, type ReactNode, useId } from "react";

/**
 * SettingsSubPage - 设置子页外壳
 *
 * 各设置子页共享同一布局骨架：PageShell 包裹 + 加载中分支 + form。
 * 保存按钮放 PageShell action（sticky 标题区右侧），通过 form 属性关联表单，
 * 无需滚动到底部即可提交。
 * 本组件消除 6 个子页重复的外壳样板，子页只关心表单内容（children）。
 *
 * @param title/description  PageShell 标题与描述
 * @param isLoading          加载中态（显示占位）
 * @param isPending          保存进行中（禁用按钮 + 切文案）
 * @param onSubmit           form 提交 handler
 * @param children           表单 section 内容（不含外层 <form>，由本组件提供）
 */
export function SettingsSubPage({
	title,
	description,
	isLoading,
	isPending,
	onSubmit,
	children,
}: {
	title: string;
	description: string;
	isLoading: boolean;
	isPending: boolean;
	onSubmit: FormEventHandler<HTMLFormElement>;
	children: ReactNode;
}) {
	const formId = useId();

	if (isLoading) {
		return (
			<PageShell title={title} description={description}>
				<div className="text-muted-foreground">加载中…</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title={title}
			description={description}
			action={
				<PermissionGuard permission="settings:update">
					<Button type="submit" form={formId} size="sm" disabled={isPending}>
						{isPending ? "保存中…" : "保存设置"}
					</Button>
				</PermissionGuard>
			}
		>
			<form id={formId} onSubmit={onSubmit} className="space-y-6">
				{children}
			</form>
		</PageShell>
	);
}
