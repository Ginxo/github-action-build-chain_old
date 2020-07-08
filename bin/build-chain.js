#!/usr/bin/env node

const process = require("process");

const fse = require("fs-extra");
const { ArgumentParser } = require("argparse");
const { Octokit } = require("@octokit/rest");

const { ClientError, logger, createConfig, createConfigLocally } = require("../src/lib/common");
const { executeGitHubAction } = require("../src/lib/api");

const pkg = require("../package.json");

async function main() {
  const parser = new ArgumentParser({
    prog: pkg.name,
    version: pkg.version,
    addHelp: true,
    description: pkg.description
  });
  parser.addArgument(["-t", "--trace"], {
    action: "storeTrue",
    help: "Show trace output"
  });
  parser.addArgument(["-d", "--debug"], {
    action: "storeTrue",
    help: "Show debugging output"
  });
  parser.addArgument(["url"], {
    metavar: "<url>",
    nargs: "?",
    help: "GitHub URL to process instead of environment variables"
  });

  const args = parser.parseArgs();

  if (args.trace) {
    logger.level = "trace";
  } else if (args.debug) {
    logger.level = "debug";
  }

  const token = env("GITHUB_TOKEN");
  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "ginxo/github-build-chain-action"
  });

  let config = undefined;
  if(args.url) {
    config = createConfigLocally(octokit, args.url, process.env);
  } else {
    const eventPath = env("GITHUB_EVENT_PATH");
    const eventDataStr = await fse.readFile(eventPath, "utf8");
    const eventData = JSON.parse(eventDataStr);
    config = createConfig(eventData, process.env);
  }
  const context = { token, octokit, config };
  await executeGitHubAction(context);
}

function env(name) {
  const val = process.env[name];
  if (!val || !val.length) {
    throw new ClientError(`environment variable ${name} not set!`);
  }
  return val;
}

if (require.main === module) {
  main().catch(e => {
    if (e instanceof ClientError) {
      process.exitCode = 2;
      logger.error(e);
    } else {
      process.exitCode = 1;
      logger.error(e);
    }
  });
}