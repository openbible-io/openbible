import { run } from "mitata";
import { Command, Option } from "commander";
const program = new Command();

program.name("bench").description("Benchmark and compare CRDT libraries.");

program
	.command("run")
	.description("Run benchmarks")
	.addOption(
		new Option("-f, --format <format>", "Output format").choices([
			"json",
			"markdown",
		]),
	)
	.argument("<string>", "Name of library to bench")
	.action(async (libName, options) => {
		console.log("bench", libName, options);
		await import(`./${libName}`);
		await run({ format: options.format ?? "mitata", throw: true });
	});

program
	.command("diff")
	.description("Diff a run against a previous run")
	.argument("<string>", "JSON file A")
	.argument("<string>", "JSON file B")
	.action((f1, f2) => {
		console.log("TODO", f1, f2);
	});

program.parse();
