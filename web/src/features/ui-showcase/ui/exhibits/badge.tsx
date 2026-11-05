import { Badge, BadgeAnchor, Button, Count, Dot, Tag, TagToggle } from "@violet/ui";
import { Bell, Clock, Layers, Link2, Star } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const ARTICLE_TAGS = ["shell", "violet", "postgres"];
const SECTIONS = ["全部", "前端", "后端", "随笔", "设计"];

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center gap-3">
			<span className="w-12 shrink-0 text-xs text-muted-foreground">{label}</span>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
		</div>
	);
}

function TagShelf() {
	const [tags, setTags] = useState(ARTICLE_TAGS);
	const [section, setSection] = useState("全部");
	return (
		<div className="flex flex-col items-start gap-4 p-1">
			<Row label="中性">
				{ARTICLE_TAGS.map((name) => (
					<Tag key={name}>#{name}</Tag>
				))}
			</Row>
			<Row label="可移除">
				{tags.map((name) => (
					<Tag
						key={name}
						onRemove={() => setTags((prev) => prev.filter((t) => t !== name))}
					>
						#{name}
					</Tag>
				))}
				{tags.length < ARTICLE_TAGS.length && (
					<Button variant="link" size="xs" onClick={() => setTags(ARTICLE_TAGS)}>
						恢复
					</Button>
				)}
			</Row>
			<div role="group" aria-label="按栏目筛选">
				<Row label="筛选">
					{SECTIONS.map((name) => (
						<TagToggle
							key={name}
							pressed={section === name}
							onPressedChange={(next) => next && setSection(name)}
						>
							{name}
						</TagToggle>
					))}
				</Row>
			</div>
			<Row label="尺寸">
				<Tag size="xs" tone="accent">
					新
				</Tag>
				<Tag size="sm">小 20</Tag>
				<Tag>中 24</Tag>
				<Tag size="lg">大 28</Tag>
			</Row>
			<Row label="图标">
				<Tag icon={<Star />}>精选</Tag>
				<Tag icon={<Link2 />}>转载</Tag>
				<Tag tone="accent" icon={<Layers />}>
					项目 · Violet
				</Tag>
			</Row>
		</div>
	);
}

function StatusShelf() {
	return (
		<div className="flex flex-col items-start gap-4 p-1">
			<div className="flex flex-wrap items-center gap-3">
				<Badge tone="ok">已发布</Badge>
				<Badge>草稿</Badge>
				<Badge tone="accent" icon={<Clock />}>
					定时 11.02 09:30
				</Badge>
				<Badge tone="warning">审核中</Badge>
				<Badge tone="off">已下线</Badge>
				<Badge tone="danger">发布失败</Badge>
			</div>
			<p className="flex items-center gap-2 text-sm text-foreground">
				第一次写 Shell 脚本
				<Tag size="xs" tone="accent">
					新
				</Tag>
			</p>
		</div>
	);
}

function CountShelf() {
	const [count, setCount] = useState(3);
	const [dot, setDot] = useState(true);
	return (
		<div className="flex flex-col items-start gap-5 p-1">
			<div className="flex items-center gap-8 pt-1">
				<BadgeAnchor badge={<Count value={count} />}>
					<button
						type="button"
						aria-label={count > 0 ? `消息，${count} 条未读` : "消息"}
						className="grid size-10 place-items-center rounded-full bg-muted text-foreground"
					>
						<Bell size={18} aria-hidden="true" />
					</button>
				</BadgeAnchor>
				<BadgeAnchor placement="edge" badge={dot ? <Dot /> : undefined}>
					<button
						type="button"
						aria-label={dot ? "Rua，有新动态" : "Rua"}
						className="grid size-10 place-items-center rounded-full bg-muted text-sm font-medium text-foreground"
					>
						Ru
					</button>
				</BadgeAnchor>
				<span className="inline-flex items-center gap-1.5 text-sm text-foreground">
					评论
					<Count variant="inline" value={count} />
				</span>
			</div>
			<div className="flex items-center gap-2">
				<Button size="sm" variant="outline" onClick={() => setCount((n) => n + 1)}>
					+1
				</Button>
				<Button size="sm" variant="outline" onClick={() => setCount((n) => n + 50)}>
					+50
				</Button>
				<Button size="sm" variant="ghost" onClick={() => setCount(0)}>
					清零
				</Button>
				<Button size="sm" variant="ghost" onClick={() => setDot((on) => !on)}>
					切换圆点
				</Button>
			</div>
		</div>
	);
}

function BadgeFamily({ state }: ExhibitRenderProps) {
	if (state === "status") return <StatusShelf />;
	if (state === "count") return <CountShelf />;
	return <TagShelf />;
}

export const badgeExhibit: Exhibit = {
	id: "badge",
	name: "徽章与标签",
	units: ["badge"],
	zone: "shelf",
	category: "display",
	footprint: { width: 400, height: 208 },
	states: [
		{ id: "tag", label: "标签" },
		{ id: "status", label: "状态徽章" },
		{ id: "count", label: "计数与圆点" },
	],
	Render: BadgeFamily,
};
