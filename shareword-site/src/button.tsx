import type { JSX } from "preact";
import { claz } from "./claz";

export default function Button(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button {...props} class={claz(props.class, "p-1 bg-gray-200 border")} />
	);
}
