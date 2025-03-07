import dt from "./diamond-types";
import yjs from "./yjs";
import naive from "./naive";
import shareword from "./shareword";

export default function run() {
	dt();
	yjs();
	//naive(); // too slow
	shareword();
}
