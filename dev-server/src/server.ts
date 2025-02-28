import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import { extname, join } from "node:path";
import type { BuildConfig, Server, ServerWebSocket } from "bun";
import { FancyAnsi } from "fancy-ansi";
import PluginWatch from "./plugin-watch";

export type WatcherMessage =
	| { type: "change" }
	| {
		type: "error";
		raw: string;
		html: string;
	};

const ansi = new FancyAnsi();
const liveReload = await fs.readFile(
	import.meta.resolve("./liveReload.js").replace("file://", ""),
	"utf8",
);
const rewriter = new HTMLRewriter().on("body", {
	element(body) {
		const html = `<script>${liveReload}</script>`;
		body.append(html, { html: true });
	},
});

async function fileStat(path: string) {
	const res: Stats = await fs.stat(path);;
	if (!res.isFile()) throw Error(`${path} not a file`);
	return res;
}

export default async function start(config: BuildConfig) {
	const outdir = config.outdir;
	if (!outdir) throw new Error("must provide `outdir` to serve from");

	const pluginWatch = PluginWatch(tryBuild);
	config.plugins = config.plugins ?? [];
	config.plugins.push(pluginWatch);

	const websockets = new Set<ServerWebSocket<unknown>>();
	// Persist this to send to new clients
	let buildError: WatcherMessage | undefined;

	function watcherError(err: AggregateError): WatcherMessage {
		const raw = Bun.inspect(err, { colors: true });
		console.error(raw);
		const html = ansi.toHtml(raw).replaceAll("\n", "<br>");
		buildError = { type: "error", raw, html };
		return buildError;
	}

	async function tryBuild() {
		let msg: WatcherMessage = { type: "change" };

		try {
			await Bun.build(config);
			pluginWatch.onBuilt();
			buildError = undefined;
		} catch (err) {
			msg = watcherError(err as AggregateError);
		}

		for (const ws of websockets) ws.send(JSON.stringify(msg));
	}

	await tryBuild();

	const server = Bun.serve({
		development: true,

		websocket: {
			message() { },
			open(ws) {
				websockets.add(ws);
				if (buildError) ws.send(JSON.stringify(buildError));
			},
			close(ws) {
				websockets.delete(ws);
			},
		},

		async fetch(req: Request, server: Server) {
			const url = new URL(req.url);
			// Unfortunately service workers intercept SSE streams and prevent a new
			// worker from activating until it's closed.
			// Web workers can't currently touch websockets, so use that instead.
			if (url.pathname === "/liveReload") {
				if (req.headers.get("upgrade") !== "websocket") {
					return new Response(null, { status: 501 });
				}

				const success = server.upgrade(req);
				if (success) return undefined; // Bun handles rest

				return new Response("WebSocket upgrade error", { status: 400 });
			}

			// Resolve SPA `index.html` pages using filesystem.
			let path = join(outdir, url.pathname);
			let stat: Stats;
			try {
				stat = await fileStat(path);
			} catch (e) {
				// If non-html, we don't have it
				if (extname(path) !== ".html" && extname(path) !== "") {
					return new Response((e as Error).toString(), { status: 404 });
				}
				// Just use index.html.
				path = join(outdir, "index.html");
				try {
					stat = await fileStat(path);
				} catch (e2) {
					return new Response((e2 as Error).toString(), { status: 404 });
				}
			}

			let body: BodyInit = Bun.file(path);
			let contentLength = stat.size;
			const contentType = body.type;

			// Inject liveReload script.
			if (contentType.includes("text/html")) {
				const text = await body.text();
				body = rewriter.transform(text);
				contentLength = body.length;
			}

			return new Response(body, {
				headers: {
					"content-length": contentLength.toString(),
					"content-type": contentType,
				},
			});
		},
	});

	console.log(`Listening on ${server.url}`);
}
