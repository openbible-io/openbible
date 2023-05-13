export interface Note {
	toId: number;
	note: string;
}

export interface Notes {
	[fromId: number]: Note
}
