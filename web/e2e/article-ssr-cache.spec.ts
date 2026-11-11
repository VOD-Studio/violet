import { expect, test } from "@playwright/test";

const PATH = "/blog/contract-rich-toc-copy";
const CACHE_HEADER = "x-ssr-cache";

test("匿名文章 HTML 复用，登录读者与偏好迁移不读写共享副本", async ({ request }) => {
	const article = `${PATH}?comment=7`;
	// 查询串本就不进入缓存；测试使用独立的偏好值避免与其他用例缓存串扰。
	const anonymous = { cookie: "appearance=light; decoration-preference=cache-contract" };
	const first = await request.get(PATH, { headers: anonymous });
	expect(first.status()).toBe(200);
	expect(first.headers()[CACHE_HEADER]).toBe("miss");
	expect(first.headers()["cache-control"]).toBe("private, no-store");
	const firstBody = await first.text();
	expect(firstBody).toContain("contract-rich-toc-copy");
	expect(firstBody).not.toContain("contract@local");

	const cached = await request.get(PATH, { headers: anonymous });
	expect(cached.headers()[CACHE_HEADER]).toBe("hit");
	expect(cached.headers()["cache-control"]).toBe("private, no-store");
	expect(await cached.text()).toBe(firstBody);

	const authenticated = await request.get(PATH, {
		headers: { cookie: `${anonymous.cookie}; contract_admin=1` },
	});
	expect(authenticated.status()).toBe(200);
	expect(authenticated.headers()[CACHE_HEADER]).toBeUndefined();
	expect(authenticated.headers()["cache-control"]).toBe("private, no-store");
	expect(await authenticated.text()).toContain("contract@local");

	const afterLogin = await request.get(PATH, { headers: anonymous });
	expect(afterLogin.headers()[CACHE_HEADER]).toBe("hit");
	expect(await afterLogin.text()).toBe(firstBody);

	const migrated = await request.get(PATH, { headers: { cookie: "theme=dark" } });
	expect(migrated.status()).toBe(200);
	expect(migrated.headers()["set-cookie"]).toContain("appearance=");
	expect(migrated.headers()[CACHE_HEADER]).toBeUndefined();

	const bypass = await request.get(article);
	expect(bypass.headers()[CACHE_HEADER]).toBeUndefined();
});
