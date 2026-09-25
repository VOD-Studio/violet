import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	Handle,
	MarkerType,
	MiniMap,
	type Node,
	type NodeProps,
	type NodeTypes,
	Position,
	ReactFlow,
	type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "cn";
import { useEffect, useMemo, useState } from "react";
import type { DatabaseSchemaTableDTO } from "../model/types";
import styles from "./SchemaRelationshipCanvas.module.css";
import {
	relationshipSourceKey,
	relationshipTargetKey,
	SCHEMA_NODE_HEIGHT,
	SCHEMA_NODE_WIDTH,
	type SchemaGraphLayout,
} from "./schema-graph-layout";

type NodeTone = "violet" | "cyan" | "rose" | "amber" | "mint";
type NodeVisualState = "idle" | "active" | "related" | "dimmed";

interface SchemaNodeData extends Record<string, unknown> {
	table: DatabaseSchemaTableDTO;
	inbound: number;
	outbound: number;
	tone: NodeTone;
	visualState: NodeVisualState;
}

type SchemaFlowNode = Node<SchemaNodeData, "schemaTable">;

export interface SchemaRelationshipCanvasProps {
	layout: SchemaGraphLayout;
	selectedKey: string | null;
	onSelectTable: (key: string) => void;
	onClearSelection: () => void;
	onOpenTableQuery: (table: DatabaseSchemaTableDTO) => void;
}

const toneClass: Record<NodeTone, string> = {
	violet: styles.toneViolet,
	cyan: styles.toneCyan,
	rose: styles.toneRose,
	amber: styles.toneAmber,
	mint: styles.toneMint,
};

const nodeTypes = { schemaTable: SchemaTableNode } satisfies NodeTypes;

/** 支持平移缩放、固定排布与悬停关系追踪的数据库图谱画布。 */
export function SchemaRelationshipCanvas({
	layout,
	selectedKey,
	onSelectTable,
	onClearSelection,
	onOpenTableQuery,
}: SchemaRelationshipCanvasProps) {
	const baseNodes = useMemo<SchemaFlowNode[]>(
		() =>
			layout.nodes.map((node) => ({
				id: node.key,
				type: "schemaTable",
				position: { x: node.x, y: node.y },
				width: SCHEMA_NODE_WIDTH,
				height: SCHEMA_NODE_HEIGHT,
				data: {
					table: node.table,
					inbound: node.inbound,
					outbound: node.outbound,
					tone: tableTone(node.table.name),
					visualState: "idle",
				},
			})),
		[layout.nodes],
	);
	const [hoveredKey, setHoveredKey] = useState<string | null>(null);
	const [instance, setInstance] = useState<ReactFlowInstance<SchemaFlowNode, Edge> | null>(null);
	const focusKey = hoveredKey ?? selectedKey;
	const relatedKeys = useMemo(() => {
		const keys = new Set<string>();
		if (focusKey) keys.add(focusKey);
		for (const relationship of layout.relationships) {
			const source = relationshipSourceKey(relationship);
			const target = relationshipTargetKey(relationship);
			if (source === focusKey || target === focusKey) {
				keys.add(source);
				keys.add(target);
			}
		}
		return keys;
	}, [focusKey, layout.relationships]);

	useEffect(() => {
		if (!instance || baseNodes.length === 0) return;
		const frame = requestAnimationFrame(() => {
			void instance.fitView({ padding: 0.18, maxZoom: 1.05 });
		});
		return () => cancelAnimationFrame(frame);
	}, [baseNodes, instance]);

	const displayNodes = useMemo(
		() =>
			baseNodes.map((node) => ({
				...node,
				data: {
					...node.data,
					visualState: nodeVisualState(node.id, focusKey, relatedKeys),
				},
			})),
		[baseNodes, focusKey, relatedKeys],
	);
	const edges = useMemo<Edge[]>(
		() =>
			layout.relationships.map((relationship, index) => {
				const source = relationshipSourceKey(relationship);
				const target = relationshipTargetKey(relationship);
				const active = source === focusKey || target === focusKey;
				const activeColor =
					source === focusKey ? "var(--graph-violet)" : "var(--graph-cyan)";
				return {
					id: `${source}:${relationship.name}:${target}:${index}`,
					source,
					target,
					type: "smoothstep",
					animated: active,
					interactionWidth: 16,
					style: {
						stroke: active
							? activeColor
							: "color-mix(in oklab, var(--graph-violet) 38%, var(--border))",
						strokeWidth: active ? 2.6 : 1.45,
						opacity: active ? 1 : focusKey ? 0.07 : 0.62,
						transition:
							"stroke 240ms ease, stroke-width 240ms ease, opacity 240ms ease",
					},
					markerEnd: {
						type: MarkerType.ArrowClosed,
						color: active
							? activeColor
							: "color-mix(in oklab, var(--graph-violet) 44%, var(--muted-foreground))",
						width: active ? 16 : 12,
						height: active ? 16 : 12,
					},
				};
			}),
		[focusKey, layout.relationships],
	);

	if (layout.nodes.length === 0) {
		return (
			<div className="text-muted-foreground flex size-full min-h-0 items-center justify-center bg-primary/3 px-6 text-center text-sm">
				当前 schema 没有已声明的外键；打开“显示孤立表”可浏览全部表。
			</div>
		);
	}

	return (
		<div className="relative size-full min-h-0 overflow-hidden">
			<ReactFlow<SchemaFlowNode, Edge>
				className={styles.canvas}
				nodes={displayNodes}
				edges={edges}
				nodeTypes={nodeTypes}
				onInit={setInstance}
				onNodeMouseEnter={(_, node) => setHoveredKey(node.id)}
				onNodeMouseLeave={(_, node) => {
					setHoveredKey((current) => (current === node.id ? null : current));
				}}
				onNodeClick={(_, node) => onSelectTable(node.id)}
				onNodeDoubleClick={(_, node) => onOpenTableQuery(node.data.table)}
				onPaneClick={onClearSelection}
				fitView
				fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
				minZoom={0.18}
				maxZoom={1.8}
				panOnDrag
				panOnScroll
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable
				proOptions={{ hideAttribution: true }}
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={24}
					size={1.15}
					color="color-mix(in oklab, var(--graph-violet) 20%, var(--border))"
				/>
				<Controls
					position="bottom-left"
					showInteractive={false}
					className={styles.controls}
				/>
				{layout.nodes.length > 18 && (
					<MiniMap
						position="bottom-right"
						className={styles.miniMap}
						pannable
						zoomable
						nodeColor="color-mix(in oklab, var(--graph-violet) 62%, var(--background))"
						nodeStrokeColor="var(--graph-violet)"
						maskColor="color-mix(in oklab, var(--background) 74%, transparent)"
					/>
				)}
			</ReactFlow>
		</div>
	);
}

function SchemaTableNode({ data }: NodeProps<SchemaFlowNode>) {
	return (
		<div
			className={cn(styles.node, toneClass[data.tone])}
			data-state={data.visualState}
			title={`${data.table.schema}.${data.table.name}`}
		>
			<Handle
				type="target"
				position={Position.Left}
				isConnectable={false}
				className={styles.handle}
			/>
			<span className={styles.kicker}>
				<span className={styles.dot} />
				table
				<span className={styles.schema}>{data.table.schema}</span>
			</span>
			<span className={styles.name}>{data.table.name}</span>
			<span className={styles.meta}>
				<span>{data.table.columns.length} 列</span>
				<span className={styles.metaDivider}>/</span>
				<span>{data.inbound + data.outbound} 关系</span>
			</span>
			<span className={styles.watermark}>
				{String(data.inbound + data.outbound).padStart(2, "0")}
			</span>
			<Handle
				type="source"
				position={Position.Right}
				isConnectable={false}
				className={styles.handle}
			/>
		</div>
	);
}

function nodeVisualState(
	key: string,
	focusKey: string | null,
	relatedKeys: Set<string>,
): NodeVisualState {
	if (!focusKey) return "idle";
	if (key === focusKey) return "active";
	return relatedKeys.has(key) ? "related" : "dimmed";
}

function tableTone(name: string): NodeTone {
	if (name.startsWith("chat_")) return "cyan";
	if (/^(persona|galler|emoji|custom_emoji)/.test(name)) return "rose";
	if (/^(users|roles|permissions|api_tokens|role_)/.test(name)) return "amber";
	if (/^(subscriptions|subscription_|notifications|friendlinks)/.test(name)) return "mint";
	return "violet";
}
