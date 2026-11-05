import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@violet/ui";
import { FileText, LayoutGrid, MessageCircle, Settings } from "lucide-react";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const SECTIONS = [
	"全部",
	"前端",
	"后端",
	"工具",
	"骑行",
	"摄影",
	"随笔",
	"读书",
	"项目",
	"设计",
	"音乐",
	"踩坑",
] as const;

function Panel({ title, note }: { title: string; note: string }) {
	return (
		<div className="flex flex-col gap-1 py-2 text-14">
			<b className="font-semibold">{title}</b>
			<span className="text-muted-foreground text-13">{note}</span>
		</div>
	);
}

function CountedTabs() {
	const [tab, setTab] = useState("articles");
	return (
		<Tabs value={tab} onValueChange={setTab} className="w-90">
			<TabsList>
				<TabsTrigger value="articles">文章</TabsTrigger>
				<TabsTrigger value="comments">
					评论
					<TabsCount>12</TabsCount>
				</TabsTrigger>
				<TabsTrigger value="reactions">
					回应
					<TabsCount>48</TabsCount>
				</TabsTrigger>
			</TabsList>
			<TabsContent value="articles">
				<Panel title="3 篇文章" note="给博客加了季节 · Postgres 锁等待 · 独库公路，六天" />
			</TabsContent>
			<TabsContent value="comments">
				<Panel title="12 条评论" note="最新一条来自小径：换季的落花太好看了" />
			</TabsContent>
			<TabsContent value="reactions">
				<Panel title="48 次回应" note="最多的是 ♥，其次是「学到了」" />
			</TabsContent>
		</Tabs>
	);
}

function IconTabs() {
	const [tab, setTab] = useState("overview");
	return (
		<Tabs value={tab} onValueChange={setTab} className="w-90">
			<TabsList>
				<TabsTrigger value="overview">
					<LayoutGrid className="size-4" />
					<span>概览</span>
				</TabsTrigger>
				<TabsTrigger value="content">
					<FileText className="size-4" />
					<span>内容</span>
				</TabsTrigger>
				<TabsTrigger value="interactions">
					<MessageCircle className="size-4" />
					<span>互动</span>
				</TabsTrigger>
				<TabsTrigger value="settings">
					<Settings className="size-4" />
					<span>设置</span>
				</TabsTrigger>
			</TabsList>
			<TabsContent value={tab}>
				<Panel title="页面分区" note="概览、内容、互动与系统设置" />
			</TabsContent>
		</Tabs>
	);
}

function OverflowTabs() {
	const [tab, setTab] = useState<string>(SECTIONS[0]);
	return (
		<Tabs value={tab} onValueChange={setTab} className="w-140">
			<TabsList>
				{SECTIONS.map((section) => (
					<TabsTrigger key={section} value={section}>
						{section}
					</TabsTrigger>
				))}
			</TabsList>
			<TabsContent value={tab}>
				<Panel title={tab} note="按专栏查看历史文章与手记" />
			</TabsContent>
		</Tabs>
	);
}

function LargeTabs() {
	const [tab, setTab] = useState("blog");
	return (
		<Tabs value={tab} onValueChange={setTab} className="w-90">
			<TabsList size="lg">
				<TabsTrigger value="blog">博客</TabsTrigger>
				<TabsTrigger value="notes">手记</TabsTrigger>
				<TabsTrigger value="lab">实验室</TabsTrigger>
			</TabsList>
			<TabsContent value="blog">
				<Panel title="博客" note="长篇技术文章与系统架构演进" />
			</TabsContent>
			<TabsContent value="notes">
				<Panel title="手记" note="日常速记与踩坑排查备忘" />
			</TabsContent>
			<TabsContent value="lab">
				<Panel title="实验室" note="原型设计与前沿特性探索" />
			</TabsContent>
		</Tabs>
	);
}

function VerticalTabs() {
	const [tab, setTab] = useState("profile");
	return (
		<Tabs orientation="vertical" value={tab} onValueChange={setTab} className="w-60">
			<TabsList>
				<TabsTrigger value="profile">个人资料</TabsTrigger>
				<TabsTrigger value="security">账户与安全</TabsTrigger>
			</TabsList>
			<TabsContent value="profile">
				<Panel title="个人资料" note="公开名称、简介与个人主页链接" />
			</TabsContent>
			<TabsContent value="security">
				<Panel title="账户与安全" note="密码更新、登录设备与会话管理" />
			</TabsContent>
		</Tabs>
	);
}

function TabsFamily({ state }: ExhibitRenderProps) {
	switch (state) {
		case "icon":
			return <IconTabs />;
		case "overflow":
			return <OverflowTabs />;
		case "large":
			return <LargeTabs />;
		case "vertical":
			return <VerticalTabs />;
		default:
			return <CountedTabs />;
	}
}

export const tabsExhibit: Exhibit = {
	id: "tabs",
	name: "标签页",
	units: ["tabs"],
	zone: "shelf",
	category: "navigation",
	footprint: { width: 560, height: 200 },
	states: [
		{ id: "counted", label: "带计数" },
		{ id: "icon", label: "带图标" },
		{ id: "overflow", label: "横向滚动" },
		{ id: "large", label: "大号" },
		{ id: "vertical", label: "竖排" },
	],
	Render: TabsFamily,
};
