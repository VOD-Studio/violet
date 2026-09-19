import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import {
	drawSelection,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { DatabaseSchemaDTO } from "../model/types";

interface SQLCodeEditorProps {
	initialValue: string;
	onChange: (value: string) => void;
	onExecute: () => void;
	schema?: DatabaseSchemaDTO;
}

const editorTheme = EditorView.theme({
	"&": {
		height: "18rem",
		backgroundColor: "transparent",
		color: "var(--foreground)",
		fontSize: "13px",
	},
	".cm-scroller": {
		fontFamily: "var(--font-mono)",
		lineHeight: "1.65",
		overflow: "auto",
	},
	".cm-content": { padding: "14px 0" },
	".cm-gutters": {
		backgroundColor: "color-mix(in oklab, var(--muted) 58%, transparent)",
		color: "var(--muted-foreground)",
		borderRight: "1px solid var(--border)",
	},
	".cm-activeLine, .cm-activeLineGutter": {
		backgroundColor: "color-mix(in oklab, var(--primary) 7%, transparent)",
	},
	".cm-cursor": { borderLeftColor: "var(--primary)" },
	".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
		backgroundColor: "color-mix(in oklab, var(--primary) 22%, transparent)",
	},
	"&.cm-focused": { outline: "none" },
});

/** admin-system 私有 SQL 编辑器；initialValue 仅在实例挂载时读取。 */
export function SQLCodeEditor({ initialValue, onChange, onExecute, schema }: SQLCodeEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const language = useRef(new Compartment());
	const onChangeRef = useRef(onChange);
	const onExecuteRef = useRef(onExecute);
	onChangeRef.current = onChange;
	onExecuteRef.current = onExecute;

	// biome-ignore lint/correctness/useExhaustiveDependencies: 编辑器实例仅挂载一次，动态值由 ref 与 compartment 同步
	useEffect(() => {
		if (!containerRef.current) return;
		const view = new EditorView({
			parent: containerRef.current,
			state: EditorState.create({
				doc: initialValue,
				extensions: [
					lineNumbers(),
					history(),
					drawSelection(),
					highlightActiveLine(),
					highlightActiveLineGutter(),
					bracketMatching(),
					autocompletion({ activateOnTyping: false }),
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					language.current.of(sql({ dialect: PostgreSQL, schema: buildSchema(schema) })),
					keymap.of([
						{
							key: "Mod-Enter",
							run: () => {
								onExecuteRef.current();
								return true;
							},
						},
						...defaultKeymap,
						...historyKeymap,
					]),
					EditorView.lineWrapping,
					editorTheme,
					EditorView.updateListener.of((update) => {
						if (update.docChanged) onChangeRef.current(update.state.doc.toString());
					}),
				],
			}),
		});
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		view.dispatch({
			effects: language.current.reconfigure(
				sql({ dialect: PostgreSQL, schema: buildSchema(schema) }),
			),
		});
	}, [schema]);

	return <div ref={containerRef} className="overflow-hidden rounded-lg border bg-card" />;
}

function buildSchema(schema?: DatabaseSchemaDTO): Record<string, string[]> {
	if (!schema) return {};
	return Object.fromEntries(
		schema.tables.map((table) => [
			`${table.schema}.${table.name}`,
			table.columns.map((column) => column.name),
		]),
	);
}
