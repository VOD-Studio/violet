import { parse as parseDomain } from "tldts";

/** A link span; offsets use JavaScript UTF-16 code units. */
export interface LinkifyMatch {
	start: number;
	end: number;
	href: string;
	text: string;
}

const HTTP = /^https?:\/\//i;
const AUTHORITY = /^[\p{L}\p{N}\p{M}.\-:[\]@%_]+/iu;
const BARE_HOST = /^[a-z0-9.-]+(?::[0-9]+)?/i;
const INTERNATIONAL_HOST = /^[\p{L}\p{N}\p{M}.-]+(?::[0-9]+)?/u;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const BLOCKED_PREVIOUS = /[a-z0-9_@./:+-]/i;
const BODY = /^[\p{L}\p{N}\p{M}._~:/?#[\]@!$&'()*+,;=%{}^-]$/u;
const FILE_SUFFIX =
	/\.(?:md|js|ts|tsx|jsx|css|json|txt|html?|xml|pdf|png|jpe?g|gif|svg|webp|ya?ml|log)$/i;
const PUNCTUATION = /[.,;:!?'"`]$/;
const EMOTE = /^\[[a-z0-9_\p{L}-]+\]/iu;
const USERINFO = /^[^/?#\s<>。，；：！？、（）【】《》「」『』“”‘’]*@/u;

function knownDomain(host: string): boolean {
	const domain = parseDomain(host, { allowPrivateDomains: false });
	return domain.isIcann === true && domain.domain !== null;
}

function validHostname(host: string): boolean {
	if (host.startsWith("[")) return host.endsWith("]");
	if (/^[0-9.]+$/.test(host)) {
		const parts = host.split(".");
		return (
			parts.length === 4 &&
			parts.every((part) => /^(?:0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255)
		);
	}
	return (
		host.length <= 253 &&
		host
			.split(".")
			.every(
				(label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
			)
	);
}

/**
 * Returns the shared HTTP cache key, omitting fragments; invalid input returns an empty string.
 *
 * @param raw - HTTP URL or a bare domain with an ICANN suffix.
 * @returns Lowercase scheme/host, default port removed, and an explicit root path.
 */
export function normalizeLinkUrl(raw: string): string {
	let source = raw.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
	if (!HTTP.test(source)) {
		if (!knownDomain(source.split(/[/?#]/, 1)[0])) return "";
		source = `https://${source}`;
	}
	if (/[\p{White_Space}\\\p{Cc}]/u.test(source) || /%(?![a-f0-9]{2})/i.test(source)) return "";
	const authority = /^https?:\/\/([^/?#]+)/i.exec(source)?.[1];
	if (!authority || authority.includes("@") || authority.includes("%")) return "";
	const port = authority.startsWith("[")
		? authority.slice(authority.indexOf("]") + 1)
		: authority.slice(authority.indexOf(":") < 0 ? authority.length : authority.indexOf(":"));
	if (port && (!/^:[0-9]+$/.test(port) || Number(port.slice(1)) > 65535)) return "";
	try {
		const parsed = new URL(source);
		// Reject legacy numeric-host coercions such as 127.1 and 0x7f000001.
		const rawHost = authority.startsWith("[")
			? authority.slice(0, authority.indexOf("]") + 1)
			: authority.split(":", 1)[0];
		if (
			!validHostname(parsed.hostname) ||
			(/^[0-9.]+$/.test(rawHost) && !validHostname(rawHost))
		)
			return "";
		if (/^(?:[0-9]+\.)*[0-9]+$/.test(parsed.hostname) && parsed.hostname !== rawHost) return "";
		parsed.hash = "";
		return parsed.href;
	} catch {
		return "";
	}
}

function skipTextToken(text: string, from: number): number {
	let end = from;
	while (end < text.length && !/[\s<>。，；：！？、（）【】《》「」『』“”‘’]/u.test(text[end]))
		end++;
	return end;
}

function scanEnd(text: string, from: number): number {
	let end = from;
	let query = false;
	while (end < text.length) {
		const character = String.fromCodePoint(text.codePointAt(end) ?? 0);
		if (!BODY.test(character) || /[。，；：！？、（）【】《》「」『』“”‘’]/u.test(character))
			break;
		if (character === "?") query = true;
		if (character === "#" && /^#[^#\s/]+#/u.test(text.slice(end))) break;
		if (character === "[" && !query && EMOTE.test(text.slice(end))) break;
		end += character.length;
	}
	return end;
}

function trimEnd(text: string, start: number, end: number): number {
	while (end > start) {
		const last = text[end - 1];
		if (PUNCTUATION.test(last)) {
			end--;
			continue;
		}
		const open = last === ")" ? "(" : last === "]" ? "[" : last === "}" ? "{" : "";
		if (!open) break;
		let balance = 0;
		for (let index = start; index < end; index++) {
			if (text[index] === open) balance++;
			if (text[index] === last) balance--;
		}
		if (balance >= 0) break;
		end--;
	}
	return end;
}

/**
 * Finds HTTP URLs and bare ICANN domains, preserving the original href fragment.
 *
 * @param text - Plain text containing URLs, topics, or emoji.
 * @returns Ordered, non-overlapping spans with UTF-16 offsets.
 */
export function tokenizeLinks(text: string): LinkifyMatch[] {
	const matches: LinkifyMatch[] = [];
	let start = 0;
	while (start < text.length) {
		const previous = start > 0 ? text[start - 1] : "";
		if (BLOCKED_PREVIOUS.test(previous)) {
			start++;
			continue;
		}
		const rest = text.slice(start);
		const protocol = HTTP.exec(rest)?.[0] ?? "";
		const scheme = SCHEME.exec(rest)?.[0] ?? "";
		const barePort =
			scheme !== "" &&
			knownDomain(scheme.slice(0, -1)) &&
			/^[0-9]/.test(rest.slice(scheme.length));
		if (!protocol && scheme && !barePort) {
			start = skipTextToken(text, start);
			continue;
		}
		const authorityStart = start + protocol.length;
		if (protocol && USERINFO.test(text.slice(authorityStart))) {
			start = skipTextToken(text, start);
			continue;
		}
		let authority = (protocol ? AUTHORITY : BARE_HOST).exec(text.slice(authorityStart))?.[0];
		if (!protocol) {
			const international = INTERNATIONAL_HOST.exec(text.slice(authorityStart))?.[0] ?? "";
			const internationalHost = international.split(":", 1)[0];
			const firstLabel = internationalHost.split(".", 1)[0];
			if (
				/[^\p{ASCII}]/u.test(internationalHost) &&
				knownDomain(internationalHost) &&
				(/^[a-z0-9]/i.test(internationalHost) || !/[a-z]/i.test(firstLabel))
			) {
				authority = international;
			}
		}
		if (!authority) {
			start++;
			continue;
		}
		let hostEnd = authorityStart + authority.length;
		while (text[hostEnd - 1] === ".") hostEnd--;
		const unicodeAuthority = text.slice(authorityStart, hostEnd);
		if (/[^\p{ASCII}]/u.test(unicodeAuthority) && !knownDomain(unicodeAuthority)) {
			let candidateEnd = hostEnd;
			while (candidateEnd > authorityStart && /[^\p{ASCII}]/u.test(text[candidateEnd - 1])) {
				candidateEnd--;
				if (knownDomain(text.slice(authorityStart, candidateEnd))) {
					hostEnd = candidateEnd;
					break;
				}
			}
		}
		const rawAuthority = text.slice(authorityStart, hostEnd);
		let end = hostEnd;
		if (hostEnd === authorityStart + authority.length && /[/?#]/.test(text[hostEnd] ?? " ")) {
			end = scanEnd(text, hostEnd);
		}
		end = trimEnd(text, start, end);
		if (text[end] === "\\") {
			start = skipTextToken(text, end);
			continue;
		}
		const raw = text.slice(start, end);
		const href = protocol ? raw : `https://${raw}`;
		const bareHost = rawAuthority.split(":", 1)[0];
		if (
			normalizeLinkUrl(href) &&
			(protocol || (knownDomain(bareHost) && !FILE_SUFFIX.test(bareHost)))
		) {
			matches.push({ start, end, href, text: raw });
		}
		// Invalid authorities must not expose an embedded www/domain as a second candidate.
		start = Math.max(start + 1, end);
	}
	return matches;
}

/**
 * Truncates long display text to 30 leading and 20 trailing characters.
 *
 * @param raw - Original URL text; the navigation href remains unchanged.
 * @returns Display text of at most 60 characters.
 */
export function displayUrl(raw: string): string {
	if (raw.length <= 60) return raw;
	return `${raw.slice(0, 30)}…${raw.slice(-20)}`;
}
