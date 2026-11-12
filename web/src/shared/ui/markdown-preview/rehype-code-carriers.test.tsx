import type { Root } from "hast";
import { raw } from "hast-util-raw";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";
import { rehypeCodeCarriers } from "./rehype-code-carriers";
import { sanitizeContent } from "./sanitize-content";

function safeHtml() {
	return (tree: Root) => sanitizeContent(raw(tree)) as Root;
}

function renderMarkdown(source: string) {
	const html = renderToStaticMarkup(
		<ReactMarkdown rehypePlugins={[rehypeCodeCarriers, safeHtml]}>{source}</ReactMarkdown>,
	);
	return new DOMParser().parseFromString(html, "text/html");
}

describe("Markdown code carriers", () => {
	it.each([
		false,
		true,
	])("preserves display and execution metadata after sanitizing (runnable=%s)", (runnable) => {
		const filename = 'src/"quoted" <img onerror=alert(1)> & file.ts';
		const source = 'const value = "<&>";\n\n';
		const info = `typescript title=${JSON.stringify(filename)} {1,3-999999999999999999999}${runnable ? ' run {"timeout_secs":10,"allow_network":false}' : ""}`;
		const doc = renderMarkdown(`\`\`\`${info}\n${source}\n\`\`\``);
		const pre = doc.querySelector("pre");
		expect(pre?.getAttribute("data-filename")).toBe(filename);
		expect(pre?.getAttribute("data-lines")).toBe("1,3-999999999999999999999");
		expect(pre?.getAttribute("data-source")).toBe(source);
		expect(pre?.getAttribute("data-lang")).toBe(runnable ? "bun" : "typescript");
		expect(pre?.getAttribute("data-runnable")).toBe(runnable ? "true" : null);
		if (runnable)
			expect(JSON.parse(pre?.getAttribute("data-overrides") ?? "null")).toEqual({
				timeout_secs: 10,
				allow_network: false,
			});
		expect(doc.querySelector("img")).toBeNull();
		expect(doc.querySelector("code")?.textContent).toBe(`${source}\n`);
	});
	it.each([
		["   ", "```", ""],
		["> ", "~~~", ""],
		["> > ", "```", ""],
		["  > ", "~~~", "- item\n\n"],
	])("reads raw metadata at nested fence offsets (%s%s)", (prefix, fence, container) => {
		const filename = 'src/"nested" <tag> & file.ts';
		const source = 'console.log("<&>");';
		const header = `${fence}typescript title=${JSON.stringify(filename)} {1} run {"timeout_secs":10}`;
		const doc = renderMarkdown(
			`前文\n\n\`\`\`text\nunrelated\n\`\`\`\n\n${container}${prefix}${header}\n${prefix}${source}\n${prefix}${fence}`,
		);
		const blocks = doc.querySelectorAll("pre");
		expect(blocks).toHaveLength(2);
		expect(blocks[0].getAttribute("data-source")).toBe("unrelated");
		expect(blocks[1].getAttribute("data-filename")).toBe(filename);
		expect(blocks[1].getAttribute("data-lines")).toBe("1");
		expect(blocks[1].getAttribute("data-lang")).toBe("bun");
		expect(blocks[1].getAttribute("data-runnable")).toBe("true");
		expect(blocks[1].getAttribute("data-overrides")).toBe('{"timeout_secs":10}');
		expect(blocks[1].getAttribute("data-source")).toBe(source);
		expect(doc.querySelector("tag")).toBeNull();
	});
	it("allows only metadata carrier attributes, not injected events or arbitrary data", () => {
		const doc = renderMarkdown(
			'<pre data-filename="&quot;&gt;&lt;script&gt;bad&lt;/script&gt;" data-lines="1,3-5" data-secret="no" onclick="alert(1)"><code>x &lt; y</code></pre>',
		);
		const pre = doc.querySelector("pre");
		expect(pre?.getAttribute("data-filename")).toBe('"><script>bad</script>');
		expect(pre?.getAttribute("data-lines")).toBe("1,3-5");
		expect(pre?.hasAttribute("data-secret")).toBe(false);
		expect(pre?.hasAttribute("onclick")).toBe(false);
		expect(doc.querySelector("script")).toBeNull();
		expect(pre?.textContent).toBe("x < y");
	});
});
