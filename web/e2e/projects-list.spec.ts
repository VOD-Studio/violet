import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { loadClient } from "./client";
import { PROJECTS_FIXTURE } from "./mock-data.mjs";
import { collectDiagnostics } from "./support.ts";

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
		route.fulfill({ contentType: "image/png", body: PNG }).catch(() => undefined),
	);
	await context.route(/missing-cover\.png/, (route) =>
		route.fulfill({ status: 404 }).catch(() => undefined),
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
	test("卡片显示状态、简介、技术栈，以及实际路线图或正式发布摘要", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		const diagnostics = collectDiagnostics(page);
		await open(page);

		const first = row(page, "路线图契约项目");
		await expect(first.getByText("进行中", { exact: true })).toBeVisible();
		await expect(first.getByText("用于项目详情页验收的样例项目。")).toBeVisible();
		await expect(first.getByRole("list", { name: "技术栈" }).getByRole("listitem")).toHaveText([
			"Go",
			"React",
			"PostgreSQL",
		]);
		const doing = first.getByRole("list", { name: "正在做" });
		await expect(doing.getByRole("listitem")).toHaveText([
			"#4 进行中的第一项",
			"#5 进行中的第二项",
		]);
		const progress = first.getByRole("progressbar", { name: "路线图契约项目 已完成占比" });
		await expect(progress).toHaveAttribute("aria-valuenow", "71");
		await expect(first).toContainText("12 / 17 · 71%");
		const stable = row(page, "Alpha 无摘要");
		await expect(stable.getByText("稳定迭代")).toBeVisible();
		await expect(stable.getByRole("link", { name: "v1.4.0" })).toHaveAttribute(
			"href",
			"https://github.com/violet-contract/alpha/releases/tag/v1.4.0",
		);
		await expect(stable.getByText("2026-10-29")).toBeVisible();
		await expect(stable.getByText("12 个版本")).toBeVisible();
		await expect(stable.getByRole("progressbar")).toHaveCount(0);
		expect(unexpected(diagnostics)).toEqual([]);
	});

	test("只有规划的条目时，保留 0% 进度，不显示空在做事项", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		const zeta = row(page, "Zeta 工具");
		await expect(zeta.getByText("已归档")).toBeVisible();
		await expect(zeta.getByText("正在做")).toHaveCount(0);
		await expect(zeta.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
		await expect(zeta).toContainText("0 / 2 · 0%");
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
			await expect(item.getByText("路线图", { exact: true })).toHaveCount(0);
			await expect(item.getByText("正在做")).toHaveCount(0);
		}
		await expect(
			row(page, "Alpha 无摘要").getByText("后端没有附带路线图摘要的项目。"),
		).toBeVisible();
	});

	test("封面在水合前失效也能回落到占位，可用封面继续显示", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		const hydration = Promise.withResolvers<void>();
		await context.route(/\/assets\/[^/]+\.js$/, async (route) => {
			await hydration.promise;
			await route.fallback();
		});
		try {
			await page.goto("/projects", { waitUntil: "commit" });
			const brokenImage = row(page, "Zeta 工具").locator("img");
			await expect
				.poll(() =>
					brokenImage.evaluate(
						(image: HTMLImageElement) => image.complete && image.naturalWidth === 0,
					),
				)
				.toBe(true);
		} finally {
			hydration.resolve();
		}
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
		expect(markup).toContain("正在做");
		expect(markup).toContain("进行中的第一项");
		expect(markup).toContain("v1.4.0");
		expect(markup).toContain("contract-cover.png");
		expect(markup).toContain("missing-cover.png");
		expect(markup.match(/role="progressbar"/g)).toHaveLength(2);
	});

	test("服务端直达已归档筛选时只直出归档项目", async ({ request }) => {
		const response = await request.get("/projects?status=archived");

		expect(response.status()).toBe(200);
		const markup = (await response.text()).replace(/<script[\s\S]*?<\/script>/g, "");
		expect(markup).toContain("Zeta 工具");
		expect(markup).toContain("空路线图项目");
		expect(markup).not.toContain("路线图契约项目");
		expect(markup).not.toContain("Alpha 无摘要");
	});

	test("状态可直达与用方向键切换，浏览器后退恢复筛选，不逐卡请求", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		const detailRequests: string[] = [];
		page.on("request", (request) => {
			if (new URL(request.url()).pathname.startsWith("/api/v1/projects/")) {
				detailRequests.push(request.url());
			}
		});
		await page.goto("/projects?status=active");

		const filters = page.getByRole("radiogroup", { name: "筛选项目状态" });
		const all = filters.getByRole("radio", { name: /全部\s*4/ });
		const active = filters.getByRole("radio", { name: "进行中" });
		const archived = filters.getByRole("radio", { name: "已归档" });
		const titles = page.getByRole("heading", { level: 2 });
		await expect(active).toBeChecked();
		await expect(titles).toHaveText(["路线图契约项目", "Alpha 无摘要"]);

		await active.focus();
		await page.keyboard.press("ArrowRight");
		await expect(archived).toBeFocused();
		await expect(archived).toBeChecked();
		await expect(page).toHaveURL(/\/projects\?status=archived$/);
		await expect(titles).toHaveText(["Zeta 工具", "空路线图项目"]);
		await row(page, "Zeta 工具").getByRole("link", { name: "Zeta 工具" }).hover();

		await all.click();
		await expect(page).toHaveURL(/\/projects$/);
		await expect(titles).toHaveText(TITLES);
		await page.goBack();
		await expect(archived).toBeChecked();
		await expect(titles).toHaveText(["Zeta 工具", "空路线图项目"]);
		expect(detailRequests).toEqual([]);
	});
});

test.describe("进入详情页", () => {
	test("点击卡片摘要（不只是标题）进入该项目的详情页", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		// 以真实坐标点击拉伸链接覆盖的摘要文字。
		const label = row(page, "路线图契约项目").getByText("正在做");
		await label.scrollIntoViewIfNeeded();
		const bounds = await label.boundingBox();
		if (!bounds) throw new Error("summary label is not visible");
		await page.mouse.click(bounds.x + 10, bounds.y + 8);

		await expect(page).toHaveURL(/\/projects\/roadmap-contract$/);
		await expect(page.getByRole("heading", { level: 1, name: "路线图契约项目" })).toBeVisible();
	});

	test("键盘：Tab 到标题链接，整卡出现聚焦环，Enter 进入详情页", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);
		const first = row(page, "路线图契约项目");
		const link = first.getByRole("link", { name: "路线图契约项目" });
		await link.focus();
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");

		await expect(link).toBeFocused();
		const outline = await first
			.locator('[data-slot="card-frame"]')
			.evaluate((node) => getComputedStyle(node).outlineStyle);
		expect(outline).toBe("solid");
		await page.keyboard.press("Enter");

		await expect(page).toHaveURL(/\/projects\/roadmap-contract$/);
		await expect(page.getByRole("heading", { level: 1, name: "路线图契约项目" })).toBeVisible();
	});

	test("标题链接指向项目详情，独立文档和外部入口不被整卡链接覆盖", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		await open(page);

		for (const project of PROJECTS_FIXTURE) {
			const item = row(page, project.title);
			await expect(item.getByRole("link", { name: project.title })).toHaveAttribute(
				"href",
				`/projects/${project.slug}`,
			);
		}

		const first = row(page, "路线图契约项目");
		const github = first.getByRole("link", { name: "GitHub" });
		await expect(github).toHaveAttribute("href", "https://github.com/example/roadmap-contract");
		await expect(github.locator("svg")).toBeVisible();
		await expect(first.getByRole("link", { name: "访问项目" })).toHaveAttribute(
			"href",
			"https://example.com/demo",
		);
		await expect(row(page, "Zeta 工具").getByRole("link")).toHaveCount(1);
		await first.getByRole("link", { name: "文档" }).click();
		await expect(page).toHaveURL(/\/projects\/roadmap-empty$/);
		await expect(page.getByRole("heading", { level: 1, name: "空路线图项目" })).toBeVisible();
	});
});

test.describe("明暗与窄屏", () => {
	test("暗色模式：卡片是深色底、浅色字，控制台无错误", async ({ page, context }) => {
		await loadClient(context);
		await routeCovers(context);
		const diagnostics = collectDiagnostics(page);
		await context.addInitScript(() => localStorage.setItem("theme", "dark"));
		await open(page);

		await expect(page.locator("html")).toHaveClass(/dark/);
		const style = await row(page, "路线图契约项目")
			.locator('[data-slot="card-frame"]')
			.evaluate((node) => {
				const toRgb = (css: string) => {
					const context = document.createElement("canvas").getContext("2d");
					if (!context) throw new Error("no 2d context");
					context.fillStyle = css;
					context.fillRect(0, 0, 1, 1);
					return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
				};
				const title = node.querySelector("h2") as HTMLElement;
				return {
					card: toRgb(getComputedStyle(node).backgroundColor),
					text: toRgb(getComputedStyle(title).color),
					page: toRgb(getComputedStyle(document.body).backgroundColor),
				};
			});
		expect(Math.min(...style.text)).toBeGreaterThan(150);
		expect(Math.max(...style.page)).toBeLessThan(80);
		expect(Math.max(...style.card)).toBeLessThan(100);
		expect(unexpected(diagnostics)).toEqual([]);
	});

	test.describe("1440px", () => {
		test.use({ viewport: { width: 1440, height: 900 } });

		test("标题筛选同排、项目双列、封面在标题上方", async ({ page, context }) => {
			await loadClient(context);
			await routeCovers(context);
			await open(page);

			const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
			const filter = await page
				.getByRole("radiogroup", { name: "筛选项目状态" })
				.boundingBox();
			const first = await row(page, "路线图契约项目").boundingBox();
			const second = await row(page, "Zeta 工具").boundingBox();
			const cover = await row(page, "路线图契约项目").locator("img").boundingBox();
			const title = await page.getByRole("heading", { name: "路线图契约项目" }).boundingBox();
			if (!heading || !filter || !first || !second || !cover || !title) {
				throw new Error("project overview layout is not visible");
			}
			expect(filter.y).toBeLessThan(heading.y + heading.height);
			expect(filter.x).toBeGreaterThan(heading.x + heading.width);
			expect(first.y).toBeCloseTo(second.y, 0);
			expect(second.x).toBeGreaterThan(first.x + first.width);
			expect(second.x + second.width - first.x).toBeCloseTo(1120, 0);
			expect(cover.y + cover.height).toBeLessThan(title.y);
		});
	});

	test.describe("390px", () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test("项目单列、摘要在标题下方，页面没有横向溢出", async ({ page, context }) => {
			await loadClient(context);
			await routeCovers(context);
			const diagnostics = collectDiagnostics(page);
			await open(page);

			const first = row(page, "路线图契约项目");
			const title = await first.getByRole("heading", { level: 2 }).boundingBox();
			const summary = await first.getByText("正在做").boundingBox();
			expect((summary?.y ?? 0) > (title?.y ?? 0) + (title?.height ?? 0)).toBe(true);
			const firstBox = await first.boundingBox();
			const secondBox = await row(page, "Zeta 工具").boundingBox();
			if (!firstBox || !secondBox) throw new Error("project cards are not visible");
			expect(firstBox.x).toBeCloseTo(secondBox.x, 0);
			expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
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
