/** mock-data.mjs 的类型声明（契约 spec 以 ESM 导入共享路由表）。 */
export declare function handle(
	method: string,
	pathname: string,
	search?: string,
	cookie?: string,
): { status: number; body: string };

/** 项目列表契约用数据：站主顺序，含完整摘要、封面失效、空路线图与读不到摘要四种。 */
export declare const PROJECTS_FIXTURE: Array<{
	title: string;
	slug: string;
	description: string;
	image_url: string;
	tech_stack: string[];
	roadmap?: {
		progress: { planned: number; in_progress: number; completed: number; total: number; percent: number };
		in_progress: Array<{ number: number; title: string }>;
		latest_completed: { number: number; title: string; completion_date: string | null } | null;
	};
}>;

/** 路线图契约用详情：计划中 3、进行中 2、已完成 12 条，顺序同后端。 */
export declare const ROADMAP_FIXTURE: {
	project: { id: string; title: string; slug: string; description: string; url: string; github_url: string; tech_stack: string[] };
	items: Array<{
		id: string;
		number: number;
		title: string;
		description: string;
		stage: "planned" | "in_progress" | "completed";
		/** 分数索引排序键 */
		position: string;
		tags: string[];
		links: Array<{ label: string; url: string }>;
		checklist: Array<{ text: string; done: boolean }>;
		completion_date: string | null;
		delivered_version: string;
		blocked: boolean;
	}>;
	relations: Array<{
		id: string;
		source_id: string;
		target_id: string;
		type: "extends" | "fixes" | "blocks";
	}>;
	progress: { planned: number; in_progress: number; completed: number; total: number; percent: number };
};
