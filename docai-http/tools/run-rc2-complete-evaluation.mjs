#!/usr/bin/env node

import process from "node:process";

import { configureRc2Evaluation } from "./rc2-evaluation-config.mjs";

const provider = process.argv[2];
const runners = {
  google: "./run-google-complete-evaluation.mjs",
  anthropic: "./run-anthropic-complete-evaluation.mjs",
  openai: "./run-openai-complete-evaluation.mjs",
};

if (!runners[provider]) {
  console.error("Usage: run-rc2-complete-evaluation.mjs <google|anthropic|openai> <task-group> [runner options]");
  process.exit(1);
}

process.argv.splice(2, 1);
configureRc2Evaluation();
await import(runners[provider]);
