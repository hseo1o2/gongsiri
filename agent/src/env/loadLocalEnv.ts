import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let loaded = false;

const resolveEnvPaths = (): string[] => {
  const explicitEnvPath = process.env.GONGSIRI_ENV_FILE;
  const agentRoot = fileURLToPath(new URL("../../", import.meta.url));
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

  return [explicitEnvPath, `${repoRoot}.env`, `${agentRoot}.env`].filter(
    (path): path is string => Boolean(path)
  );
};

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
    return null;
  }

  const [key, ...rest] = trimmed.split("=");
  const value = rest.join("=").trim();
  return [key.trim(), value.replace(/^['"]|['"]$/g, "")];
};

export const loadLocalEnvFiles = (): void => {
  if (loaded) {
    return;
  }

  for (const path of resolveEnvPaths()) {
    if (!existsSync(path)) {
      continue;
    }

    const contents = readFileSync(path, "utf-8");
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  loaded = true;
};
