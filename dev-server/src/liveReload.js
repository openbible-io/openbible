const logPrefix = "[LiveReload]";

const overlay = document.createElement("div");
overlay.id = "liveReloadOverlay";
overlay.style.position = "fixed";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.zIndex = "100";
overlay.style.display = "none";
overlay.style.justifyContent = "center";
overlay.style.alignItems = "center";
overlay.style.background = "white";

const contents = document.createElement("pre");

overlay.append(contents);
document.body.append(overlay);

let ws;

function connect() {
	console.log(logPrefix, "connecting");

	ws = new WebSocket("/liveReload");
	ws.addEventListener("message", (ev) => {
		/** @type import("./server.ts").WatcherMessage */
		const data = JSON.parse(ev.data);
		if (data.type === "error") {
			console.error(logPrefix + "\n" + data.raw);
			contents.innerHTML = data.html;
			overlay.style.display = "flex";
		} else if (data.type === "change") {
			// I used to have a special CSS stylesheet swapping impl here.
			location.reload();
		} else {
			console.error(logPrefix, "unknown event", ev);
		}
	});
	ws.addEventListener("open", () => {
		console.log(logPrefix, "connected");
	});
	ws.addEventListener("close", () => {
		console.log(logPrefix, "closed");
		setTimeout(connect, 1000);
	});
}

connect();
