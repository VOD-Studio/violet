import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Switch } from "@shared/ui/base/switch";
import { Textarea } from "@shared/ui/base/textarea";
import type { ReactNode } from "react";

/**
 * 样例分组：标目 + token 出处注 + 真实控件活体。
 */
export function SpecimenGroup({
	id,
	title,
	provenance,
	children,
}: {
	id?: string;
	title: string;
	/** 该组控件消费的 token / 类名出处 */
	provenance: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			aria-label={title}
			className="border-b border-border/40 py-6 last:border-b-0"
		>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 className="text-lg font-bold">{title}</h3>
				<code className="font-mono text-xs text-muted-foreground">{provenance}</code>
			</div>
			<div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
		</section>
	);
}

/** 按钮控件活体样例 */
export function SpecimensButtons() {
	return (
		<SpecimenGroup
			id="buttons"
			title="按钮"
			provenance="bg-primary · bg-secondary · border · bg-brand · bg-destructive · hover:bg-accent"
		>
			<Button>主要动作</Button>
			<Button variant="secondary">次要动作</Button>
			<Button variant="outline">描边动作</Button>
			<Button variant="brand">品牌动作</Button>
			<Button variant="destructive">危险动作</Button>
			<Button variant="ghost">幽灵动作</Button>
			<Button variant="outline" disabled>
				不可用
			</Button>
			<Button size="sm">小尺寸</Button>
			<Button size="lg">大尺寸</Button>
		</SpecimenGroup>
	);
}

/** 徽章状态活体样例 */
export function SpecimensStatus() {
	return (
		<>
			<SpecimenGroup
				id="status"
				title="徽章"
				provenance="bg-primary · bg-secondary · bg-brand-wash + text-brand-wash-foreground · border-border"
			>
				<Badge>默认</Badge>
				<Badge variant="secondary">次要</Badge>
				<Badge variant="brand">品牌</Badge>
				<Badge variant="outline">描边</Badge>
				<Badge variant="ghost">幽灵</Badge>
				<Badge variant="destructive">危险</Badge>
			</SpecimenGroup>

			<SpecimenGroup title="状态" provenance="disabled:opacity-50 · animate-pulse（骨架）">
				<Button disabled>禁用态</Button>
				<span
					role="status"
					aria-label="骨架屏"
					className="block h-9 w-28 animate-pulse rounded-md bg-muted"
				/>
			</SpecimenGroup>
		</>
	);
}

/** 输入交互活体样例 */
export function SpecimensFeedback() {
	return (
		<SpecimenGroup
			id="feedback"
			title="输入与交互"
			provenance="border-input · bg-transparent · ring-ring（焦点环）"
		>
			<Input placeholder="单行输入" className="w-56" />
			<Textarea placeholder="多行输入" className="h-20 w-72" />
			<div className="flex items-center gap-2">
				<Switch aria-label="开关样例" />
				<span className="text-sm text-muted-foreground">开关</span>
			</div>
		</SpecimenGroup>
	);
}

/**
 * 组件活样例全量展示。
 */
export function ComponentSpecimens() {
	return (
		<div className="mt-8 rounded-2xl border border-border/40 bg-card/50 p-6 space-y-2">
			<SpecimensButtons />
			<SpecimensStatus />
			<SpecimensFeedback />
		</div>
	);
}
