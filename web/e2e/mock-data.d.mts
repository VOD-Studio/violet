/** mock-data.mjs 的类型声明（契约 spec 以 ESM 导入共享路由表）。 */
export declare function handle(
	method: string,
	pathname: string,
	search?: string,
	cookie?: string,
): { status: number; body: string };

/** 路线图契约用详情：计划中 3、进行中 2、已完成 12 条，顺序同后端。 */
export declare const ROADMAP_FIXTURE: {
	project: { title: string; slug: string; description: string; url: string; github_url: string; tech_stack: string[] };
	items: Array<{
		id: string;
		number: number;
		title: string;
		description: string;
		stage: "planned" | "in_progress" | "completed";
		tags: string[];
		links: Array<{ label: string; url: string }>;
		completion_date: string | null;
		delivered_version: string;
	}>;
	progress: { planned: number; in_progress: number; completed: number; total: number; percent: number };
};
