// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function claz(...names: any[]): string {
	return names.filter(Boolean).join(" ");
}
