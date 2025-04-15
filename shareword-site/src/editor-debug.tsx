import type { Text as Doc } from "@openbible/shareword";
import Button from "./button";
import { useState } from "preact/hooks";
import { Fragment } from "preact";
import { claz } from "./claz";

function OplogTab(props: { doc: Doc }) {
	const { doc } = props;

	return <>
		Frontier: {doc.oplog.frontier.join(", ")}
		<div class="grid grid-cols-[repeat(4,auto)_1fr] gap-1 gap-x-4 overflow-auto">
			<div>Index</div>
			<div>Id</div>
			<div>Position</div>
			<div>Items</div>
			{doc.oplog.ops.items.map((op, i) => (
					<Fragment key={op.site + op.siteClock}>
						<div>{doc.oplog.ops.starts[i]}</div>
						<div>{op.site} {op.siteClock}</div>
						<div>{op.position}</div>
						<span
							class="overflow-hidden text-nowrap text-ellipsis"
							title={op.data.toString()}
						>
							{op.data}
						</span>
					</Fragment>
				)
			)}
		</div>
	</>
}

function CrdtTab(props: { doc: Doc }) {
	const { doc } = props;
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
