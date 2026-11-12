import {
	Avatar,
	List,
	ListItem,
	ListItemAction,
	ListItemChevron,
	ListItemContent,
	ListItemDescription,
	ListItemIcon,
	ListItemTitle,
	ListItemValue,
	Tag,
} from "@violet/ui";
import {
	Bell,
	BookOpen,
	Clock,
	Download,
	Ellipsis,
	FileImage,
	FileText,
	Languages,
	Palette,
	Pencil,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { portrait } from "./art";

const SETTINGS = [
	{ icon: <Bell />, title: "评论通知", description: "有人回复我的评论时提醒", value: "已开启" },
	{ icon: <Languages />, title: "语言", description: "界面与日期格式", value: "简体中文" },
	{
		icon: <ShieldCheck />,
		title: "两步验证",
		description: "登录时额外输入验证码",
		value: "未开启",
	},
	{ icon: <Palette />, title: "外观", description: "季节与深浅色", value: "跟随季节" },
] satisfies { icon: ReactNode; title: string; description: string; value: string }[];

const MEMBERS = [
	{ name: "Rua", email: "xunrua@rua.plus", role: "站长", src: portrait(200) },
	{ name: "小径", email: "xiaojing@io.dev", role: "编辑", src: portrait(70) },
	{ name: "南山记", email: "nanshan@site.cn", role: "评论管理", src: portrait(20) },
];

const FILES = [
	{ icon: <FileImage />, name: "cover-season.webp", meta: "1.2 MB · 11-02" },
	{ icon: <FileText />, name: "saber-design.md", meta: "48 KB · 10-28" },
	{ icon: <FileImage />, name: "duku-day3.jpg", meta: "3.4 MB · 10-12" },
];

const NAV = [
	{ icon: <BookOpen />, title: "全部文章", count: "270" },
	{ icon: <Pencil />, title: "草稿", count: "3" },
	{ icon: <Clock />, title: "定时", count: "1" },
	{ icon: <Trash2 />, title: "回收站", count: "12" },
];

function SettingsList() {
	const [last, setLast] = useState("");
	return (
		<div className="flex w-100 flex-col gap-3">
			<List aria-label="设置">
				{SETTINGS.map((row) => (
					<ListItem key={row.title} onClick={() => setLast(row.title)}>
						<ListItemIcon>{row.icon}</ListItemIcon>
						<ListItemContent>
							<ListItemTitle>{row.title}</ListItemTitle>
							<ListItemDescription>{row.description}</ListItemDescription>
						</ListItemContent>
						<ListItemValue>{row.value}</ListItemValue>
						<ListItemChevron />
					</ListItem>
				))}
			</List>
			<p className="px-3 text-13 text-muted-foreground" aria-live="polite">
				{last ? `已进入「${last}」` : "点一行进入下一级"}
			</p>
		</div>
	);
}

function MemberList() {
	return (
		<List aria-label="成员" className="w-100">
			{MEMBERS.map((member) => (
				<ListItem key={member.name}>
					<Avatar name={member.name} src={member.src} alt="" />
					<ListItemContent>
						<ListItemTitle>{member.name}</ListItemTitle>
						<ListItemDescription mono>{member.email}</ListItemDescription>
					</ListItemContent>
					<Tag>{member.role}</Tag>
					<ListItemAction aria-label={`${member.name} 的更多操作`}>
						<Ellipsis />
					</ListItemAction>
				</ListItem>
			))}
		</List>
	);
}

function FileList() {
	return (
		<List aria-label="文件" className="w-100">
			{FILES.map((file) => (
				<ListItem key={file.name}>
					<ListItemIcon>{file.icon}</ListItemIcon>
					<ListItemContent>
						<ListItemTitle mono>{file.name}</ListItemTitle>
						<ListItemDescription mono>{file.meta}</ListItemDescription>
					</ListItemContent>
					<ListItemAction aria-label={`下载 ${file.name}`}>
						<Download />
					</ListItemAction>
				</ListItem>
			))}
		</List>
	);
}

function NavList({ density }: { density: "comfortable" | "compact" }) {
	const [current, setCurrent] = useState(NAV[0].title);
	return (
		<List aria-label="文章分类" density={density} className="w-60">
			{NAV.map((item) => (
				<ListItem
					key={item.title}
					onClick={() => setCurrent(item.title)}
					aria-current={current === item.title ? "page" : undefined}
				>
					<ListItemIcon>{item.icon}</ListItemIcon>
					<ListItemContent>
						<ListItemTitle>{item.title}</ListItemTitle>
					</ListItemContent>
					<ListItemValue mono>{item.count}</ListItemValue>
				</ListItem>
			))}
		</List>
	);
}

function ListStage({ state }: ExhibitRenderProps) {
	switch (state) {
		case "people":
			return <MemberList />;
		case "files":
			return <FileList />;
		case "navigation":
			return <NavList density="comfortable" />;
		case "compact":
			return <NavList density="compact" />;
		default:
			return <SettingsList />;
	}
}

export const listExhibit: Exhibit = {
	id: "list",
	name: "列表",
	units: ["list"],
	zone: "content",
	category: "display",
	footprint: { width: 400, height: 280 },
	states: [
		{ id: "settings", label: "设置列表" },
		{ id: "people", label: "成员列表" },
		{ id: "files", label: "文件列表" },
		{ id: "navigation", label: "当前项" },
		{ id: "compact", label: "紧凑" },
	],
	Render: ListStage,
};
