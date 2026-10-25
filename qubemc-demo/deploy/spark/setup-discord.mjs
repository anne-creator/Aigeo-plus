import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
const root = homedir();
const env = { ...process.env, PATH: `${root}/.local/bin:${root}/.nvm/versions/node/v22.23.4/bin:${process.env.PATH}`, NEMOCLAW_DISABLE_TELEMETRY: "1", NEMOCLAW_NON_INTERACTIVE: "1", DISCORD_SERVER_ID: process.env.DISCORD_SERVER_ID, DISCORD_REQUIRE_MENTION: process.env.DISCORD_REQUIRE_MENTION || "1", NEMOCLAW_VLLM_PORT: "18000", NEMOCLAW_COMPATIBLE_AUTH_MODE: "none" };
env.DISCORD_BOT_TOKEN = env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN;
if (!env.DISCORD_BOT_TOKEN?.trim()) { console.error("Set DISCORD_TOKEN or DISCORD_BOT_TOKEN in the Spark user's .env file."); process.exit(1); }
if (!/^\d+$/.test(env.DISCORD_SERVER_ID || "")) { console.error("Set DISCORD_SERVER_ID in the Spark user's .env file."); process.exit(1); }
const token = readFileSync(`${root}/.nemoclaw/ollama-proxy-token`, "utf8").trim();
env.COMPATIBLE_API_KEY = token;
env.NEMOCLAW_OLLAMA_PROXY_TOKEN = token;
for (const args of [["cofloor", "channels", "add", "discord"], ["cofloor", "rebuild", "--yes"]]) {
  const result = spawnSync("nemoclaw", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
