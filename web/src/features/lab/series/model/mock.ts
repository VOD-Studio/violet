export type SeriesSurface = "shelf" | "detail" | "reader";
export type SeriesVariant = "A" | "B" | "C";

export interface MockChapter {
	id: string;
	no: number;
	title: string;
	excerpt: string;
	readMinutes: number;
	publishedAt: string;
	current?: boolean;
	anchors: string[];
}

export interface MockSection {
	id: string;
	title: string;
	chapters: MockChapter[];
}

export interface MockBook {
	slug: string;
	title: string;
	subtitle: string;
	author: string;
	description: string;
	coverUrl: string | null;
	status: "ongoing" | "finished";
	progress: number;
	sections: MockSection[];
}

const chapter = (
	id: string,
	no: number,
	title: string,
	excerpt: string,
	publishedAt: string,
	readMinutes: number,
	anchors: string[],
	current = false,
): MockChapter => ({ id, no, title, excerpt, publishedAt, readMinutes, anchors, current });

export const JAVA_BOOK: MockBook = {
	slug: "java-notes",
	title: "Java 渐进式笔记",
	subtitle: "从 Hello World 到并发模型",
	author: "super",
	description:
		"一本随着真实问题持续生长的在线技术书。每章先建立一个可运行的事实，再解释 JVM 与语言规则为什么这样设计；中途补写的基础篇会插回正确的阅读位置。",
	coverUrl:
		"https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=720&q=85",
	status: "ongoing",
	progress: 46,
	sections: [
		{
			id: "foundation",
			title: "第一部 · 语言地基",
			chapters: [
				chapter(
					"env",
					1,
					"环境与第一个程序",
					"JDK、javac 与 java 各自负责什么。",
					"2026-03-02",
					6,
					["JDK 与 JRE", "编译链", "第一个程序"],
				),
				chapter(
					"types",
					2,
					"基本类型与运算符",
					"八种原始类型、自动提升与相等性边界。",
					"2026-03-05",
					9,
					["原始类型", "数值提升", "相等性"],
				),
				chapter(
					"memory",
					3,
					"JVM 内存模型速览",
					"栈帧、堆与方法区，为引用语义铺地基。",
					"2026-05-18",
					14,
					["栈帧", "堆", "方法区"],
				),
				chapter(
					"flow",
					4,
					"流程控制与循环",
					"分支、循环与模式匹配的边界。",
					"2026-03-11",
					8,
					["分支", "循环", "模式匹配"],
				),
			],
		},
		{
			id: "objects",
			title: "第二部 · 对象世界",
			chapters: [
				chapter(
					"methods",
					5,
					"方法、数组与字符串",
					"值传递、数组协变与 String 常量池。",
					"2026-03-20",
					12,
					["值传递", "数组", "String"],
				),
				chapter(
					"class",
					6,
					"类、对象与初始化顺序",
					"从构造器链看对象如何真正诞生。",
					"2026-04-02",
					15,
					["类与对象", "构造器链", "初始化顺序"],
				),
				chapter(
					"poly",
					7,
					"继承与多态",
					"虚方法表、重载解析与组合优于继承。",
					"2026-04-15",
					18,
					["继承", "动态分派", "组合"],
					true,
				),
				chapter(
					"interface",
					8,
					"接口与抽象类",
					"default 方法、SAM 转换与边界设计。",
					"2026-04-28",
					11,
					["接口", "抽象类", "SAM"],
				),
			],
		},
		{
			id: "modern",
			title: "第三部 · 现代 Java",
			chapters: [
				chapter(
					"collections",
					9,
					"集合框架",
					"ArrayList、HashMap 与迭代一致性。",
					"2026-05-06",
					20,
					["List", "HashMap", "迭代器"],
				),
				chapter(
					"generics",
					10,
					"泛型与类型擦除",
					"PECS、类型擦除与运行时边界。",
					"2026-05-12",
					13,
					["泛型", "类型擦除", "PECS"],
				),
				chapter(
					"exceptions",
					11,
					"异常处理",
					"受检异常、资源关闭与栈轨迹。",
					"2026-06-01",
					10,
					["异常层级", "资源管理", "栈轨迹"],
				),
				chapter(
					"stream",
					12,
					"Lambda 与 Stream",
					"捕获语义、惰性求值与并行边界。",
					"2026-06-20",
					16,
					["Lambda", "Stream", "并行"],
				),
			],
		},
	],
};

export const SHELF_BOOKS: MockBook[] = [
	JAVA_BOOK,
	{
		...JAVA_BOOK,
		slug: "rust-to-production",
		title: "Rust 从零到生产",
		subtitle: "跟着 borrow checker 建立心智模型",
		coverUrl:
			"https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=720&q=85",
		status: "ongoing",
		progress: 18,
	},
	{
		...JAVA_BOOK,
		slug: "distributed-systems",
		title: "分布式系统手记",
		subtitle: "从不可能性到共识算法",
		coverUrl:
			"https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=720&q=85",
		status: "finished",
		progress: 100,
	},
	{
		...JAVA_BOOK,
		slug: "compiler-walk",
		title: "编译原理漫游",
		subtitle: "手写一门小语言的五次停靠",
		coverUrl: null,
		status: "ongoing",
		progress: 0,
	},
];

export const CURRENT_CHAPTER =
	JAVA_BOOK.sections.flatMap((section) => section.chapters).find((item) => item.current) ??
	JAVA_BOOK.sections[0].chapters[0];
