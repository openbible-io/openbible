#!/usr/bin/env bun
import { defaultConfig as config, start } from "@openbible/dev-server";

const entrypoints = process.argv[2];
if (entrypoints) config.entrypoints = entrypoints.split(",");

start(config);
