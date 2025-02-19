import { watch, type FSWatcher } from "node:fs";
import type { PluginBuilder } from "bun";

const name = "watcher";

type Watchers = { [path: string]: FSWatcher };

export default function PluginWatch(onSourceChange: () => void | Promise<void>) {
	const watchers: Watchers = {};
	let toWatch = new Set<string>();

	return {
		name,

		setup(builder: PluginBuilder) {
			builder.onStart(() => {
				toWatch = new Set();
			});

			builder.onLoad({ filter: /./ }, (args) => {
				toWatch.add(args.path);
			});
		},

		// Watching files can be expensive.
		// To avoid frequesntly rewatching the same files we reconcile after build.
		// Sadly there's no lifecycle hook for this yet, so the `Bun.build` caller
		// must do so afterwards.
		onBuilt() {
			const existingWatchers = new Set(Object.keys(watchers));
			const toStop = existingWatchers.difference(toWatch);
			const toStart = toWatch.difference(existingWatchers);

			for (const p of toStop) watchers[p].close();
			for (const p of toStart) watchers[p] = watch(p, onSourceChange);
		},
	};
}
