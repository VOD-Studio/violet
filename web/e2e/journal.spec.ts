import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { ROADMAP_FIXTURE } from "./mock-data.mjs";

test("手记首屏与旧进展书签只显示发布的笔记", async ({ page, context, request }) => {
	await loadClient(context);
	const requests: string[] = [];
	page.on("request", (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith("/api/v1/journal")) {
			requests.push(path);
		}
	});

	for (const path of ["/journal", "/journal?type=progress"]) {
		const response = await request.get(path);
		expect(response.ok()).toBe(true);
		const html = await response.text();
		expect(html).toContain("缓存接管笔记");
		expect(html).not.toContain("第 1 条契约提交");
		expect(html).not.toContain("自动进展同步失败");

		await page.goto(path);
		const journal = page.getByRole("main");
		await expect(journal.getByRole("radio", { name: "全部", exact: true })).toBeChecked();
		await expect(journal.getByRole("radio", { name: "进展", exact: true })).toHaveCount(0);
		await expect(journal.getByRole("link", { name: /契约提交|v2\.0\.0/ })).toHaveCount(0);
		await expect(journal.getByRole("link", { name: "缓存接管笔记" })).toBeVisible();
	}
	expect(requests).toEqual([]);
});

test("旧进展地址保留项目和标签筛选，手写类型与详情正常可用", async ({ page, context }) => {
	await loadClient(context);
	const projectId = ROADMAP_FIXTURE.project.id;
	await page.goto(`/journal?type=progress&project_id=${projectId}&tag=roadmap`);
	const journal = page.getByRole("main");
	const note = journal.getByRole("link", { name: "路线图记录方法" });
	await expect(journal.getByText("按标签筛选：roadmap")).toBeVisible();
	await expect(note).toBeVisible();
	await expect(journal.getByRole("link", { name: "缓存接管笔记" })).toHaveCount(0);

	await journal.getByRole("radio", { name: "踩坑" }).click();
	await expect(journal.getByText("没有符合筛选条件的手记")).toBeVisible();
	await journal.getByRole("radio", { name: "想法" }).click();
	await expect(page).toHaveURL(
		(url) =>
			url.searchParams.get("type") === "idea" &&
			url.searchParams.get("project_id") === projectId &&
			url.searchParams.get("tag") === "roadmap",
	);
	await note.click();
	await expect(journal.getByRole("heading", { name: "路线图记录方法", level: 1 })).toBeVisible();
	await expect(journal.getByText("先记下要解决的问题，再拆分实施步骤。")).toBeVisible();
});
