export interface HighlightToken {
	content: string;
	color?: string;
	fontStyle?: number;
}

export interface HighlightRequest {
	id: number;
	code: string;
	language: string;
}

export type HighlightResponse = { id: number } & (
	| { lines: HighlightToken[][] }
	| { error: string }
);
