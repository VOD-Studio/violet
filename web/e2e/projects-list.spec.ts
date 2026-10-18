import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { PROJECTS_FIXTURE } from "./mock-data.mjs";
import { collectDiagnostics, loadClient } from "./support.ts";

const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNIK+/4DwAFEQJlVsm6GwAAAABJRU5ErkJggg==",
	"base64",
);
const TITLES = PROJECTS_FIXTURE.map((project) => project.title);

/** 夹具里有一个封面失效的项目，浏览器必然报它的 404；其余的才是意外。 */
const unexpected = (diagnostics: string[]) =>
	diagnostics.filter((entry) => !entry.includes("missing-cover.png"));

/**
 * 可用的封面返回图片，失效的封面返回 404。
 * 离开页面时还没应答的请求已被浏览器取消，这时再应答会抛错，忽略即可。
 */
async function routeCovers(context: BrowserContext) {
	await context.route(/contract-cover\.png/, (route) =>
		route.fulfill({ contentType: "image/png", body: PNG }).catch(() => {}),
	);
	await context.route(/missing-cover\.png/, (route) =>
		route.fulfill({ status: 404 }).catch(() => {}),
	);
}

const row = (page: Page, title: string) =>
	page.getByRole("heading", { level: 2, name: title }).locator("xpath=ancestor::li[1]");

async function open(page: Page) {
	await page.goto("/projects");
	await expect(page.getByRole("heading", { level: 1, name: "项目" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2 })).toHaveCount(TITLES.length);
}

test.describe("项目列表", () => {
	test("每行有标题、简介、技术栈；有路线图的项目显示现在在做、最近完成与进度", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await routeCovers(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);

		const first = row(page, "路线图契约项目");
		await expect(first.getByText("用于项目详情页验收的样例项目。")).toBeVisible();
		await expect(first.getByRole("list", { name: "技术栈" }).getByRole("listitem")).toHaveText([
			"Go",
			"React",
			"PostgreSQL",
		]);
		const doing = first.getByText("现在在做").locator("xpath=..");
		await expect(doing.getByRole("listitem")).toHaveText([
			"#4进行中的第一项",
			"#5进行中的第二项",
		]);
		const latest = first.getByText("最近完成").locator("xpath=..");
		await expect(latest).toContainText("#17已完成的第 17 项");
		await expect(latest).toContainText("2026-10-20");
		const progress = first.getByRole("progressbar", { name: "路线图契约项目 已完成占比" });
		await expect(progress).toHaveAttribute("aria-valuenow", "71");
		await expect(first).toContainText("已完成 12/17 · 进行中 2 · 计划中 3");
		expect(unexpected(diagnostics)).toEqual([]);
	});

	test("没有进行中或已完成时给出明确的说明，进度为 0", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		const zeta = row(page, "Zeta 工具");
		await expect(zeta.getByText("暂无进行中")).toBeVisible();
		await expect(zeta.getByText("最近完成").locator("xpath=..")).toContainText("暂无");
		await expect(zeta.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
		await expect(zeta).toContainText("已完成 0/2 · 进行中 0 · 计划中 2");
	});

	test("项目按后端给出的站主顺序排列，不按标题或时间重排", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		await expect(page.getByRole("heading", { level: 2 })).toHaveText(TITLES);
		expect([...TITLES].sort()).not.toEqual(TITLES);
	});

	test("没有路线图条目或读不到摘要的项目照常显示，没有空的进度区", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		for (const title of ["空路线图项目", "Alpha 无摘要"]) {
			const item = row(page, title);
			await expect(item).toBeVisible();
			await expect(item.getByRole("progressbar")).toHaveCount(0);
			await expect(item.getByText("现在在做")).toHaveCount(0);
			await expect(item.getByText("最近完成")).toHaveCount(0);
		}
		await expect(
			row(page, "Alpha 无摘要").getByText("后端没有附带路线图摘要的项目。"),
		).toBeVisible();
	});

	test("封面：可用的显示真实图片，失效或没有的显示首字母占位，页面没有碎图", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);
		await expect(row(page, "路线图契约项目").locator("img")).toBeVisible();
		await expect(row(page, "Zeta 工具").getByTestId("project-cover-placeholder")).toBeVisible();

		await expect(row(page, "Zeta 工具").locator("img")).toHaveCount(0);
		await expect(row(page, "Zeta 工具").getByTestId("project-cover-placeholder")).toHaveText(
			"Z",
		);
		for (const title of ["空路线图项目", "Alpha 无摘要"]) {
			await expect(row(page, title).locator("img")).toHaveCount(0);
			await expect(row(page, title).getByTestId("project-cover-placeholder")).toBeVisible();
		}
		const broken = await page.evaluate(
			() =>
				[...document.querySelectorAll("img")].filter(
					(image) => image.complete && image.naturalWidth === 0,
				).length,
		);
		expect(broken).toBe(0);
		const loaded = await row(page, "路线图契约项目")
			.locator("img")
			.evaluate((image: HTMLImageElement) => image.naturalWidth);
		expect(loaded).toBeGreaterThan(0);
	});

	test("页面直出时就在 HTML 里：全部项目、摘要与顺序；没有路线图条目的项目没有进度区", async ({
		request,
	}) => {
		const response = await request.get("/projects");

		expect(response.status()).toBe(200);
		const markup = (await response.text()).replace(/<script[\s\S]*?<\/script>/g, "");
		const positions = TITLES.map((title) => markup.indexOf(title));
		expect(positions.every((position) => position > 0)).toBe(true);
		expect([...positions].sort((a, b) => a - b)).toEqual(positions);
		expect(markup).toContain("现在在做");
		expect(markup).toContain("进行中的第一项");
		expect(markup.match(/role="progressbar"/g)).toHaveLength(2);
	});
});

test.describe("进入详情页", () => {
	test("点击一行的任意位置（不只是标题）进入该项目的详情页", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		// 链接拉伸到了整行，标签文字被它盖住；Playwright 不会点被盖住的元素，所以用真实坐标点击，
		// 效果和访客点在这里一样
		const label = await row(page, "路线图契约项目").getByText("现在在做").boundingBox();
		if (!label) throw new Error("summary label is not visible");
		await page.mouse.click(label.x + 10, label.y + 8);

		await expect(page).toHaveURL(/\/projects\/roadmap-contract$/);
		await expect(page.getByRole("heading", { level: 1, name: "路线图契约项目" })).toBeVisible();
	});

	test("键盘：Tab 到标题链接，整行出现聚焦环，Enter 进入详情页", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);
		const first = row(page, "路线图契约项目");
		const link = first.getByRole("link", { name: "路线图契约项目" });
		await link.focus();
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");

		await expect(link).toBeFocused();
		const outline = await first.evaluate((node) => getComputedStyle(node).outlineStyle);
		expect(outline).toBe("solid");
		await page.keyboard.press("Enter");

		await expect(page).toHaveURL(/\/projects\/roadmap-contract$/);
		await expect(page.getByRole("heading", { level: 1, name: "路线图契约项目" })).toBeVisible();
	});

	test("列表里每个标题都是指向 /projects/<slug> 的链接，行内没有别的链接", async ({
		page,
		context,
	}) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		for (const project of PROJECTS_FIXTURE) {
			const item = row(page, project.title);
			await expect(item.getByRole("link")).toHaveCount(1);
			await expect(item.getByRole("link")).toHaveAttribute(
				"href",
				`/projects/${project.slug}`,
			);
		}
	});
});

test.describe("明暗与窄屏", () => {
	test("暗色模式：行是深色底、浅色字，控制台无错误", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		const diagnostics = collectDiagnostics(page);
		await context.addInitScript(() => localStorage.setItem("theme", "dark"));
		await open(page);

		await expect(page.locator("html")).toHaveClass(/dark/);
		const style = await row(page, "路线图契约项目").evaluate((node) => {
			const toRgb = (css: string) => {
				const context = document.createElement("canvas").getContext("2d");
				if (!context) throw new Error("no 2d context");
				context.fillStyle = css;
				context.fillRect(0, 0, 1, 1);
				return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
			};
			const title = node.querySelector("h2") as HTMLElement;
			return {
				border: getComputedStyle(node).borderTopStyle,
				text: toRgb(getComputedStyle(title).color),
				page: toRgb(getComputedStyle(document.body).backgroundColor),
			};
		});
		expect(Math.min(...style.text)).toBeGreaterThan(150);
		expect(Math.max(...style.page)).toBeLessThan(80);
		expect(style.border).toBe("solid");
		expect(unexpected(diagnostics)).toEqual([]);
	});

	test.describe("390px", () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test("摘要区堆在下面，页面没有横向溢出", async ({ page, context }) => {
			await loadClient(context);
			await routeCovers(context);
			const diagnostics = collectDiagnostics(page);
			await open(page);

			const first = row(page, "路线图契约项目");
			const title = await first.getByRole("heading", { level: 2 }).boundingBox();
			const summary = await first.getByText("现在在做").boundingBox();
			expect((summary?.y ?? 0) > (title?.y ?? 0) + (title?.height ?? 0)).toBe(true);
			const overflow = await page.evaluate(
				() =>
					Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
					window.innerWidth,
			);
			expect(overflow).toBeLessThanOrEqual(0);
			expect(unexpected(diagnostics)).toEqual([]);
		});
	});
});
