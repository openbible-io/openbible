export interface Highlight {
	toId: number;
	color: string;
}

export interface Highlights {
	[fromId: number]: Highlight
}

