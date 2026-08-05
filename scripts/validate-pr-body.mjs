#!/usr/bin/env node
import { validatePullRequestBody } from "../maintainer/src/traceability.js";

const errors = validatePullRequestBody(process.env.PR_BODY);
if (errors.length > 0) {
  console.error("Pull request traceability check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Pull request links tracked work and contains the required delivery evidence.");
}
