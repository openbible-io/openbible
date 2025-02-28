import type { Position } from "list-positions";
import { RichText } from "@list-positions/formatting"

const t = new RichText();

let p: Position = t.text.cursorAt(0);
[p] = t.text.insert(p, "a");
[p] = t.text.insert(p, "b");
[p] = t.text.insert(p, "c");

t.format(0, t.text.indexOfCursor(p), "italic", 100);
[p] = t.text.insert(p, "d");
[p] = t.insertWithFormat(t.text.indexOfCursor(p), { bold: 100 }, "e");

console.dir(t.save(), { depth: null })

console.log(t.formattedChars());

