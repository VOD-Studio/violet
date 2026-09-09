const X_HOSTS: Record<string, true> = {
	"x.com": true,
	"www.x.com": true,
	"mobile.x.com": true,
	"twitter.com": true,
	"www.twitter.com": true,
	"mobile.twitter.com": true,
};

export interface XPostReference {
	id: string;
	href: string;
}

/** 识别 X 与旧 Twitter 域名下的单条动态地址，并返回无查询参数的规范链接。 */
export function parseXPostUrl(value: string): XPostReference | null {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (
		(url.protocol !== "https:" && url.protocol !== "http:") ||
		url.username ||
		url.password ||
		url.port ||
		!X_HOSTS[url.hostname.toLowerCase()]
	) {
		return null;
	}

	const segments = url.pathname.split("/").filter(Boolean);
	let id = "";
	let canonicalPath = "";

	if (segments[0] === "i" && segments[1] === "web" && segments[2] === "status") {
		id = segments[3] ?? "";
		canonicalPath = `/i/web/status/${id}`;
	} else if (segments[1] === "status" || segments[1] === "statuses") {
		id = segments[2] ?? "";
		canonicalPath = `/${segments[0]}/status/${id}`;
	}

	if (!/^\d{1,25}$/u.test(id)) return null;

	return {
		id,
		href: `https://x.com${canonicalPath}`,
	};
}
