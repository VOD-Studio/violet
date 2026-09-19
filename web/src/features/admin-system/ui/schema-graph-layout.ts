import {
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
	forceX,
	forceY,
	type SimulationLinkDatum,
	type SimulationNodeDatum,
} from "d3-force";
import type { DatabaseSchemaRelationshipDTO, DatabaseSchemaTableDTO } from "../model/types";
export const SCHEMA_NODE_WIDTH = 184;
export const SCHEMA_NODE_HEIGHT = 104;

const LAYOUT_PADDING = 64;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface SchemaGraphNode {
	key: string;
	table: DatabaseSchemaTableDTO;
	x: number;
	y: number;
	inbound: number;
	outbound: number;
}

export interface SchemaGraphLayout {
	width: number;
	height: number;
	nodes: SchemaGraphNode[];
	relationships: DatabaseSchemaRelationshipDTO[];
}

interface BuildSchemaGraphLayoutOptions {
	tables: DatabaseSchemaTableDTO[];
	relationships: DatabaseSchemaRelationshipDTO[];
	includeIsolated: boolean;
	focusKey?: string | null;
}

interface ForceNode extends SimulationNodeDatum {
	id: string;
	table: DatabaseSchemaTableDTO;
	inbound: number;
	outbound: number;
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
	source: string | ForceNode;
	target: string | ForceNode;
}

export function schemaTableKey(table: Pick<DatabaseSchemaTableDTO, "schema" | "name">): string {
	return `${table.schema}.${table.name}`;
}

export function relationshipSourceKey(relationship: DatabaseSchemaRelationshipDTO): string {
	return `${relationship.source_schema}.${relationship.source_table}`;
}

export function relationshipTargetKey(relationship: DatabaseSchemaRelationshipDTO): string {
	return `${relationship.target_schema}.${relationship.target_table}`;
}

/** 使用确定性的力导向模拟压紧关系簇，避免高入度表把全景拉成长条。 */
export function buildSchemaGraphLayout({
	tables,
	relationships,
	includeIsolated,
	focusKey,
}: BuildSchemaGraphLayoutOptions): SchemaGraphLayout {
	const tableByKey = new Map(tables.map((table) => [schemaTableKey(table), table]));
	const validRelationships = relationships.filter(
		(relationship) =>
			tableByKey.has(relationshipSourceKey(relationship)) &&
			tableByKey.has(relationshipTargetKey(relationship)),
	);
	const degree = relationshipDegree(validRelationships);
	const relatedKeys = new Set<string>();
	for (const relationship of validRelationships) {
		relatedKeys.add(relationshipSourceKey(relationship));
		relatedKeys.add(relationshipTargetKey(relationship));
	}
	const visibleKeys = [...(includeIsolated ? tableByKey.keys() : relatedKeys)].sort(
		(left, right) => {
			const degreeDelta = (degree.get(right) ?? 0) - (degree.get(left) ?? 0);
			return degreeDelta || left.localeCompare(right);
		},
	);
	const directionCounts = relationshipDirectionCounts(validRelationships);
	if (focusKey && tableByKey.has(focusKey)) {
		return buildFocusedLayout({
			focusKey,
			tableByKey,
			relationships: validRelationships,
			directionCounts,
			degree,
		});
	}
	const nodes: ForceNode[] = visibleKeys.flatMap((key, index) => {
		const table = tableByKey.get(key);
		if (!table) return [];
		const radius = 64 * Math.sqrt(index);
		const angle = index * GOLDEN_ANGLE;
		const counts = directionCounts.get(key) ?? { inbound: 0, outbound: 0 };
		return [
			{
				id: key,
				table,
				inbound: counts.inbound,
				outbound: counts.outbound,
				x: Math.cos(angle) * radius,
				y: Math.sin(angle) * radius,
			},
		];
	});
	const links: ForceLink[] = validRelationships.flatMap((relationship) => {
		const source = relationshipSourceKey(relationship);
		const target = relationshipTargetKey(relationship);
		return relatedKeys.has(source) && relatedKeys.has(target) ? [{ source, target }] : [];
	});

	const simulation = forceSimulation(nodes)
		.force(
			"link",
			forceLink<ForceNode, ForceLink>(links)
				.id((node) => node.id)
				.distance(248)
				.strength(0.22),
		)
		.force(
			"charge",
			forceManyBody<ForceNode>()
				.strength((node) => -300 - Math.min(220, (node.inbound + node.outbound) * 9))
				.distanceMax(1000),
		)
		.force("collision", forceCollide<ForceNode>(118).strength(0.94).iterations(3))
		.force("x", forceX<ForceNode>(0).strength(0.045))
		.force("y", forceY<ForceNode>(0).strength(0.055))
		.stop();
	for (let index = 0; index < 360; index++) simulation.tick();
	simulation.stop();

	if (nodes.length === 0) {
		return { width: 560, height: 320, nodes: [], relationships: validRelationships };
	}
	const centers = nodes.map((node) => ({
		node,
		x: (node.x ?? 0) * 1.18,
		y: (node.y ?? 0) * 0.9,
	}));
	const minX = Math.min(...centers.map((item) => item.x));
	const maxX = Math.max(...centers.map((item) => item.x));
	const minY = Math.min(...centers.map((item) => item.y));
	const maxY = Math.max(...centers.map((item) => item.y));
	const graphNodes: SchemaGraphNode[] = centers.map(({ node, x, y }) => ({
		key: node.id,
		table: node.table,
		x: x - minX + LAYOUT_PADDING,
		y: y - minY + LAYOUT_PADDING,
		inbound: node.inbound,
		outbound: node.outbound,
	}));

	return {
		width: Math.max(560, maxX - minX + SCHEMA_NODE_WIDTH + LAYOUT_PADDING * 2),
		height: Math.max(320, maxY - minY + SCHEMA_NODE_HEIGHT + LAYOUT_PADDING * 2),
		nodes: graphNodes,
		relationships: validRelationships,
	};
}

interface BuildFocusedLayoutOptions {
	focusKey: string;
	tableByKey: Map<string, DatabaseSchemaTableDTO>;
	relationships: DatabaseSchemaRelationshipDTO[];
	directionCounts: Map<string, { inbound: number; outbound: number }>;
	degree: Map<string, number>;
}

function buildFocusedLayout({
	focusKey,
	tableByKey,
	relationships,
	directionCounts,
	degree,
}: BuildFocusedLayoutOptions): SchemaGraphLayout {
	const focusRelationships = relationships.filter((relationship) => {
		const source = relationshipSourceKey(relationship);
		const target = relationshipTargetKey(relationship);
		return source === focusKey || target === focusKey;
	});
	const outgoingKeys = uniqueSortedKeys(
		focusRelationships
			.filter((relationship) => relationshipSourceKey(relationship) === focusKey)
			.map(relationshipTargetKey)
			.filter((key) => key !== focusKey),
		degree,
	);
	const outgoingSet = new Set(outgoingKeys);
	const incomingKeys = uniqueSortedKeys(
		focusRelationships
			.filter((relationship) => relationshipTargetKey(relationship) === focusKey)
			.map(relationshipSourceKey)
			.filter((key) => key !== focusKey && !outgoingSet.has(key)),
		degree,
	);
	const maxRows = 6;
	const rowGap = 40;
	const columnGap = 300;
	const leftColumns = Math.ceil(incomingKeys.length / maxRows);
	const rightColumns = Math.ceil(outgoingKeys.length / maxRows);
	const sideColumns = Math.max(1, leftColumns, rightColumns);
	const tallestColumn = Math.min(maxRows, Math.max(1, incomingKeys.length, outgoingKeys.length));
	const height = Math.max(
		520,
		tallestColumn * SCHEMA_NODE_HEIGHT + (tallestColumn - 1) * rowGap + LAYOUT_PADDING * 2,
	);
	const centerX = LAYOUT_PADDING + sideColumns * columnGap;
	const centerY = (height - SCHEMA_NODE_HEIGHT) / 2;
	const nodes: SchemaGraphNode[] = [];
	const focusTable = tableByKey.get(focusKey);
	if (focusTable) {
		nodes.push(toSchemaGraphNode(focusKey, focusTable, centerX, centerY, directionCounts));
	}
	nodes.push(
		...placeFocusedSide({
			keys: incomingKeys,
			direction: -1,
			centerX,
			height,
			maxRows,
			rowGap,
			columnGap,
			tableByKey,
			directionCounts,
		}),
		...placeFocusedSide({
			keys: outgoingKeys,
			direction: 1,
			centerX,
			height,
			maxRows,
			rowGap,
			columnGap,
			tableByKey,
			directionCounts,
		}),
	);
	return {
		width: sideColumns * columnGap * 2 + SCHEMA_NODE_WIDTH + LAYOUT_PADDING * 2,
		height,
		nodes,
		relationships: focusRelationships,
	};
}

interface PlaceFocusedSideOptions {
	keys: string[];
	direction: -1 | 1;
	centerX: number;
	height: number;
	maxRows: number;
	rowGap: number;
	columnGap: number;
	tableByKey: Map<string, DatabaseSchemaTableDTO>;
	directionCounts: Map<string, { inbound: number; outbound: number }>;
}

function placeFocusedSide({
	keys,
	direction,
	centerX,
	height,
	maxRows,
	rowGap,
	columnGap,
	tableByKey,
	directionCounts,
}: PlaceFocusedSideOptions): SchemaGraphNode[] {
	return keys.flatMap((key, index) => {
		const table = tableByKey.get(key);
		if (!table) return [];
		const column = Math.floor(index / maxRows);
		const row = index % maxRows;
		const columnSize = Math.min(maxRows, keys.length - column * maxRows);
		const columnHeight = columnSize * SCHEMA_NODE_HEIGHT + Math.max(0, columnSize - 1) * rowGap;
		return [
			toSchemaGraphNode(
				key,
				table,
				centerX + direction * (column + 1) * columnGap,
				(height - columnHeight) / 2 + row * (SCHEMA_NODE_HEIGHT + rowGap),
				directionCounts,
			),
		];
	});
}

function toSchemaGraphNode(
	key: string,
	table: DatabaseSchemaTableDTO,
	x: number,
	y: number,
	directionCounts: Map<string, { inbound: number; outbound: number }>,
): SchemaGraphNode {
	const counts = directionCounts.get(key) ?? { inbound: 0, outbound: 0 };
	return { key, table, x, y, inbound: counts.inbound, outbound: counts.outbound };
}

function uniqueSortedKeys(keys: string[], degree: Map<string, number>): string[] {
	return [...new Set(keys)].sort((left, right) => {
		const degreeDelta = (degree.get(right) ?? 0) - (degree.get(left) ?? 0);
		return degreeDelta || left.localeCompare(right);
	});
}

function relationshipDegree(relationships: DatabaseSchemaRelationshipDTO[]): Map<string, number> {
	const degree = new Map<string, number>();
	for (const relationship of relationships) {
		const source = relationshipSourceKey(relationship);
		const target = relationshipTargetKey(relationship);
		degree.set(source, (degree.get(source) ?? 0) + 1);
		degree.set(target, (degree.get(target) ?? 0) + 1);
	}
	return degree;
}

function relationshipDirectionCounts(
	relationships: DatabaseSchemaRelationshipDTO[],
): Map<string, { inbound: number; outbound: number }> {
	const counts = new Map<string, { inbound: number; outbound: number }>();
	for (const relationship of relationships) {
		const source = relationshipSourceKey(relationship);
		const target = relationshipTargetKey(relationship);
		const sourceCounts = counts.get(source) ?? { inbound: 0, outbound: 0 };
		const targetCounts = counts.get(target) ?? { inbound: 0, outbound: 0 };
		sourceCounts.outbound++;
		targetCounts.inbound++;
		counts.set(source, sourceCounts);
		counts.set(target, targetCounts);
	}
	return counts;
}
