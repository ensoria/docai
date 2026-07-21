#!/usr/bin/env node

import { configureRc2Evaluation } from "./rc2-evaluation-config.mjs";

configureRc2Evaluation();
await import("./record-complete-token-load.mjs");
