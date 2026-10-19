import type { BrowserContext } from "@playwright/test";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";

export type RoadmapFixtureItem = (typeof ROADMAP_FIXTURE.items)[number];

export type MoveBody = {
	stage: string;
	before_id: string;
	after_id: string;
	completion_date?: string;
	delivered_version?: string;
};

/** 一次写请求：方法、条目或关系的 ID（新建时为空串）与请求体。 */
export interface RoadmapWrite {
	method: string;
	action: "create" | "update" | "move" | "delete" | "restore" | "relate" | "unrelate";
	itemId: string;
	body: Record<string, unknown> | null;
}

type Relation = (typeof ROADMAP_FIXTURE.relations)[number];

const SLUG = ROADMAP_FIXTURE.project.slug;
const ITEMS =
	/\/api\/v1\/admin\/projects\/[^/]+\/roadmap\/items(?:\/([^/]+))?(?:\/(move|restore))?$/;
const RELATIONS = /\/api\/v1\/admin\/projects\/[^/]+\/roadmap\/relations(?:\/([^/]+))?$/;
const RANK: Record<string, number> = { planned: 0, in_progress: 1, completed: 2 };

/** 同一类型里从 from 能否走到 to：建立 to→from 之前用它判断会不会成环。 */
function reaches(relations: Relation[], type: string, from: string, to: string): boolean {
	const seen = new Set<string>();
	const stack = [from];
	while (stack.length > 0) {
		const current = stack.pop() as string;
		if (current === to) return true;
		if (seen.has(current)) continue;
		seen.add(current);
		for (const relation of relations)
			if (relation.type === type && relation.source_id === current)
				stack.push(relation.target_id);
	}
	return false;
}

/** 后端的展示顺序：已完成按完成日期倒序、同日按编号倒序，其余阶段按位置（字节序）。 */
function sortItems(items: RoadmapFixtureItem[]) {
	items.sort((a, b) => {
		if (a.stage !== b.stage) return RANK[a.stage] - RANK[b.stage];
		if (a.stage === "completed")
			return (
				(b.completion_date ?? "").localeCompare(a.completion_date ?? "") ||
				b.number - a.number
			);
		if (a.position !== b.position) return a.position < b.position ? -1 : 1;
		return a.number - b.number;
	});
}

/** 落在两侧条目之间的位置，与后端的分数索引同一种字节序。 */
function positionBetween(items: RoadmapFixtureItem[], beforeId: string, afterId: string) {
	const before = items.find((item) => item.id === beforeId);
	const after = items.find((item) => item.id === afterId);
	if (before) return `${before.position}V`;
	if (after) return `0${after.position}`;
	return "V";
}

/**
 * 路线图的「后端」：浏览器里的路线图请求返回当前状态，写接口按请求改状态并返回条目。
 * 服务端渲染仍由 mock 服务应答原始数据；保存之后的重新拉取经过这里。
 * 同一个浏览器上下文里的多个页面共用这份状态，可以模拟两个标签页。
 */
export async function roadmapBackend(context: BrowserContext, options: { fail?: boolean } = {}) {
	const items: RoadmapFixtureItem[] = structuredClone(ROADMAP_FIXTURE.items);
	const relations: Relation[] = structuredClone(ROADMAP_FIXTURE.relations);
	let nextRelation = 1;
	const deleted: RoadmapFixtureItem[] = [];
	const writes: RoadmapWrite[] = [];
	const moves: Array<{ itemId: string; body: MoveBody }> = [];
	let nextNumber = Math.max(...items.map((item) => item.number)) + 1;

	await context.route(`**/api/v1/projects/by-slug/${SLUG}/roadmap`, (route) => {
		// 两端都还在的关系才返回，与后端一致
		const alive = new Set(items.map((item) => item.id));
		const visible = relations.filter(
			(relation) => alive.has(relation.source_id) && alive.has(relation.target_id),
		);
		return route.fulfill({ json: { data: { ...ROADMAP_FIXTURE, items, relations: visible } } });
	});
	await context.route(RELATIONS, (route) => {
		const request = route.request();
		const [, relationId = ""] = request.url().match(RELATIONS) ?? [];
		const body = request.postData() ? (request.postDataJSON() as Record<string, string>) : null;
		const action = request.method() === "DELETE" ? "unrelate" : "relate";
		writes.push({ method: request.method(), action, itemId: relationId, body });
		if (options.fail)
			return route.fulfill({ status: 500, json: { error: "INTERNAL", message: "保存失败" } });
		if (action === "unrelate") {
			const index = relations.findIndex((relation) => relation.id === relationId);
			if (index >= 0) relations.splice(index, 1);
			return route.fulfill({ json: { message: "条目关系已删除" } });
		}
		const { source_id, target_id, type } = body ?? {};
		const reject = (status: number, message: string) =>
			route.fulfill({ status, json: { error: "BAD_REQUEST", message } });
		if (source_id === target_id) return reject(400, "条目关系不能指向自身");
		if (
			relations.some(
				(relation) =>
					relation.type === type &&
					relation.source_id === source_id &&
					relation.target_id === target_id,
			)
		)
			return reject(409, "同类型的条目关系已存在");
		if (reaches(relations, type, target_id, source_id))
			return reject(400, "该关系会形成同类型的环");
		const created: Relation = {
			...structuredClone(ROADMAP_FIXTURE.relations[0]),
			id: `43000000-0000-0000-0000-${String(nextRelation++).padStart(12, "0")}`,
			source_id,
			target_id,
			type: type as Relation["type"],
		};
		relations.push(created);
		return route.fulfill({ status: 201, json: { data: created } });
	});
	await context.route(ITEMS, (route) => {
		const request = route.request();
		const [, itemId = "", suffix] = request.url().match(ITEMS) ?? [];
		const method = request.method();
		const body = request.postData()
			? (request.postDataJSON() as Record<string, unknown>)
			: null;
		const action =
			suffix === "move"
				? "move"
				: suffix === "restore"
					? "restore"
					: method === "DELETE"
						? "delete"
						: method === "PUT"
							? "update"
							: "create";
		writes.push({ method, action, itemId, body });
		if (action === "move") moves.push({ itemId, body: body as MoveBody });
		if (options.fail)
			return route.fulfill({ status: 500, json: { error: "INTERNAL", message: "保存失败" } });

		if (action === "create") {
			const stage = String(body?.stage ?? "planned");
			const inStage = items.filter((item) => item.stage === stage);
			const number = nextNumber++;
			const created: RoadmapFixtureItem = {
				...structuredClone(ROADMAP_FIXTURE.items[0]),
				id: `41000000-0000-0000-0000-${String(number).padStart(12, "0")}`,
				number,
				title: String(body?.title ?? ""),
				description: "",
				stage: stage as RoadmapFixtureItem["stage"],
				position: positionBetween(items, inStage.at(-1)?.id ?? "", ""),
				tags: [],
				links: [],
				checklist: [],
				completion_date: stage === "completed" ? "2026-10-21" : null,
				delivered_version: "",
				blocked: false,
			};
			items.push(created);
			sortItems(items);
			return route.fulfill({ status: 201, json: { data: created } });
		}
		if (action === "restore") {
			const index = deleted.findIndex((item) => item.id === itemId);
			const [restored] = deleted.splice(index, 1);
			items.push(restored);
			sortItems(items);
			return route.fulfill({ json: { data: restored } });
		}
		const index = items.findIndex((item) => item.id === itemId);
		if (index < 0) return route.fulfill({ status: 404, json: { error: "NOT_FOUND" } });
		const item = items[index];
		if (action === "delete") {
			deleted.push(...items.splice(index, 1));
			return route.fulfill({ status: 204, body: "" });
		}
		if (action === "update") {
			// 全量替换内容；没给完成日期时保留原值，阶段只能靠移动改变
			Object.assign(item, {
				title: body?.title,
				description: body?.description ?? "",
				tags: body?.tags ?? [],
				links: body?.links ?? [],
				checklist: body?.checklist ?? [],
				delivered_version: body?.delivered_version ?? "",
				...(body?.completion_date ? { completion_date: body.completion_date } : {}),
			});
			sortItems(items);
			return route.fulfill({ json: { data: item } });
		}
		const move = body as MoveBody;
		items.splice(index, 1);
		const completed = move.stage === "completed";
		Object.assign(item, {
			stage: move.stage,
			position: positionBetween(items, move.before_id, move.after_id),
			completion_date: completed
				? (move.completion_date ?? item.completion_date ?? "2026-10-21")
				: null,
			delivered_version: completed ? (move.delivered_version ?? item.delivered_version) : "",
		});
		items.push(item);
		sortItems(items);
		return route.fulfill({ json: { data: item } });
	});
	return { items, relations, writes, moves };
}
