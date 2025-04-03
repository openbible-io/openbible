import { run, bench, do_not_optimize } from 'mitata';

const arr: number[] = [];
for (let i = 0, t = 8192; i < t; i++) {
	arr.push(Math.round(Math.random() * t));
}

function add(size: number) {
	let res = "";
	for (let i = 0; i < size; i++) res += arr[i];

	return res.length;
}

function concat(size: number) {
	let res = "";
	for (let i = 0; i < size; i++) res = res.concat(arr[i]);

	return res.length;
}

bench('$method ($size)', function* (state) {
	const size = state.get('size');
	const method = state.get('method');
	const fn = method === "add" ? add : concat;

	yield () => do_not_optimize(fn(size));
})
	.range('size', 1, arr.length)
	.args("method", ["add", "concat"]);

await run();
// Conclusion: concat only slightly slower and fine to use on
// string ops.
