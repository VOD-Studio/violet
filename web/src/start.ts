import { findEditorGuideChapter } from "@features/editor-docs/model/chapters";
import { findSectionBySlug } from "@features/inkline-workbench/model/sections";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

const LEGACY_ROOTS: Record<string, string | undefined> = {
	"/editor-guide": "/projects/violet/docs/editor",
	"/inkline": "/projects/inkline/docs",
	"/kanban": "/projects/kanban/docs",
	"/persona": "/chat/personas",
	"/profile": "/settings",
};

function destinationFor(pathname: string): string | undefined {
	const path = pathname.replace(/\/$/, "");
	const root = LEGACY_ROOTS[path];
	if (root) return root;
	const match = /^\/(editor-guide|inkline)\/([^/]+)$/.exec(path);
	if (!match) return undefined;
	let slug: string;
	try {
		slug = decodeURIComponent(match[2]);
	} catch {
		return undefined;
	}
	if (match[1] === "editor-guide" && findEditorGuideChapter(slug)) {
		return `/projects/violet/docs/editor/${encodeURIComponent(slug)}`;
	}
	if (match[1] === "inkline" && findSectionBySlug(slug)) {
		return `/projects/inkline/docs/${encodeURIComponent(slug)}`;
	}
	return undefined;
}

const legacyPublicRoutes = createMiddleware().server(({ request, handlerType, next }) => {
	if (handlerType !== "router" || (request.method !== "GET" && request.method !== "HEAD")) {
		return next();
	}
	const url = new URL(request.url);
	const destination = destinationFor(url.pathname);
	if (!destination) return next();
	// Router 的 parse/stringify 会合并重复键并规范化编码；HTTP 迁移必须在解析之前取原始查询串。
	// 不写 fragment，让浏览器将旧书签的 hash 继承到新页面。
	return new Response(null, {
		status: 301,
		headers: { location: `${destination}${url.search}` },
	});
});

// 自定义 startInstance 后框架不再自动添加默认 CSRF middleware，保留相同的 serverFn 过滤条件。
const csrfMiddleware = createCsrfMiddleware({
	filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
	requestMiddleware: [csrfMiddleware, legacyPublicRoutes],
}));
