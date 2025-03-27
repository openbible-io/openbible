import type { Text as Doc } from "@openbible/shareword";
import Button from "./button";
import { useState } from "preact/hooks";
import { Fragment } from "preact";
import { claz } from "./claz";

function OplogTab(props: { doc: Doc }) {
	const { doc } = props;
	const { fields } = doc.oplog.items;

	return <>
		Frontier: {doc.oplog.frontier.join(", ")}
		<div class="grid grid-cols-[repeat(5,auto)_1fr] gap-1 gap-x-4 overflow-auto">
			<div>Index</div>
			<div>Len</div>
			<div>Site</div>
			<div>Clock</div>
			<div>Position</div>
			<div>Items</div>
			{fields.position.map((p, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
					<Fragment key={i}>
						<div>{doc.oplog.ranges.fields.start[i]}</div>
						<div>{doc.oplog.ranges.fields.len[i]}</div>
						<div>{doc.oplog.sites.keys[fields.site[i]]}</div>
						<div>{fields.clock[i]}</div>
						<div>{p}</div>
						<span
							class="overflow-hidden text-nowrap text-ellipsis"
							title={fields.items[i]}
						>
							{fields.items[i]}
						</span>
					</Fragment>
				)
			)}
		</div>
	</>
}

function CrdtTab(props: { doc: Doc }) {
	const { doc } = props;
	const { fields } = doc.oplog.items;
				//const len = doc.oplog.ranges.fields.len[i];
				//const parents: Record<number, number[]> = {};
				//for (let j = 0; j < len; j++) {
				//	const maybeParents = doc.oplog.parents[i + j];
				//	if (maybeParents) parents[j] = maybeParents;
				//}

	return "graph";
}

export default function EditorDebug(props: { class?: string; doc: Doc }) {
	const { doc } = props;
	const [tab, setTab] = useState<"oplog" | "crdt">("oplog");

	return (
		<div class={claz(props.class, "flex flex-col overflow-auto")}>
			<div class="flex gap-1 items-baseline">
				{doc.site}
				<Button onClick={() => setTab("oplog")}>Oplog</Button>
				<Button onClick={() => setTab("crdt")}>Crdt</Button>
			</div>
			{tab === "oplog" && <OplogTab doc={doc} />}
			{tab === "crdt" && <CrdtTab doc={doc} />}
		</div>
	);
}
