import type { Extension as FromMarkdownExtension } from "mdast-util-from-markdown";
import { classifyCharacter } from "micromark-util-classify-character";
import { resolveAll } from "micromark-util-resolve-all";
import type {
	Construct,
	Event,
	Extension,
	Resolver,
	State,
	Token,
	Tokenizer,
} from "micromark-util-types";
import type { Processor } from "unified";

declare module "micromark-util-types" {
	interface TokenTypeMap {
		highlight: "highlight";
		highlightSequence: "highlightSequence";
		highlightSequenceTemporary: "highlightSequenceTemporary";
		highlightText: "highlightText";
	}
}

const resolveHighlight: Resolver = (events, context) => {
	for (let index = 0; index < events.length; index++) {
		const closing = events[index];
		if (
			closing[0] !== "enter" ||
			closing[1].type !== "highlightSequenceTemporary" ||
			!closing[1]._close
		)
			continue;
		for (let open = index - 1; open >= 0; open--) {
			const opening = events[open];
			if (
				opening[0] !== "exit" ||
				opening[1].type !== "highlightSequenceTemporary" ||
				!opening[1]._open
			)
				continue;
			opening[1].type = "highlightSequence";
			closing[1].type = "highlightSequence";
			const highlight: Token = {
				type: "highlight",
				start: { ...opening[1].start },
				end: { ...closing[1].end },
			};
			const text: Token = {
				type: "highlightText",
				start: { ...opening[1].end },
				end: { ...closing[1].start },
			};
			const inner = resolveAll(
				context.parser.constructs.insideSpan.null ?? [],
				events.slice(open + 1, index),
				context,
			);
			const replacement: Event[] = [
				["enter", highlight, context],
				["enter", opening[1], context],
				["exit", opening[1], context],
				["enter", text, context],
				...inner,
				["exit", text, context],
				["enter", closing[1], context],
				["exit", closing[1], context],
				["exit", highlight, context],
			];
			events.splice(open - 1, index - open + 3, ...replacement);
			index = open + replacement.length - 2;
			break;
		}
	}
	for (const event of events)
		if (event[1].type === "highlightSequenceTemporary") event[1].type = "data";
	return events;
};

const tokenizeHighlight: Tokenizer = function (effects, ok, nok) {
	const before = classifyCharacter(this.previous);
	const previous = this.previous;
	const events = this.events;
	let size = 0;
	const more: State = (code) => {
		if (code === 61) {
			if (size === 2) return nok(code);
			effects.consume(code);
			size++;
			return more;
		}
		if (size !== 2) return nok(code);
		const token = effects.exit("highlightSequenceTemporary");
		const after = classifyCharacter(code);
		token._open = !after || (after === 2 && !!before);
		token._close = !before || (before === 2 && !!after);
		return ok(code);
	};
	return (code) => {
		if (previous === 61 && events[events.length - 1]?.[1].type !== "characterEscape")
			return nok(code);
		effects.enter("highlightSequenceTemporary");
		return more(code);
	};
};

const construct: Construct = {
	name: "highlight",
	tokenize: tokenizeHighlight,
	resolveAll: resolveHighlight,
};
const syntax: Extension = {
	text: { 61: construct },
	insideSpan: { null: [construct] },
	attentionMarkers: { null: [61] },
};
const fromMarkdown: FromMarkdownExtension = {
	enter: {
		highlight(token) {
			this.enter({ type: "emphasis", children: [], data: { hName: "mark" } }, token);
		},
	},
	exit: {
		highlight(token) {
			this.exit(token);
		},
	},
};

/** 将高亮作为行内语法解析，转义标记和代码 token 不参与匹配。 */
export function remarkHighlight(this: Processor) {
	const data = this.data();
	data.micromarkExtensions ??= [];
	data.fromMarkdownExtensions ??= [];
	data.micromarkExtensions.push(syntax);
	data.fromMarkdownExtensions.push(fromMarkdown);
}
