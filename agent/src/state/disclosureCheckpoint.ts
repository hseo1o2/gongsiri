import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type DisclosureCheckpointState = {
  disclosures: Record<string, string>;
};

const DEFAULT_CHECKPOINT_PATH = fileURLToPath(
  new URL("../../../data/agent-runtime/disclosure-checkpoints.json", import.meta.url)
);

const createEmptyState = (): DisclosureCheckpointState => ({
  disclosures: {}
});

const getParentDirectory = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");

  if (index <= 0) {
    return ".";
  }

  return normalized.slice(0, index);
};

export const resolveCheckpointPath = (): string =>
  process.env.GONGSIRI_CHECKPOINT_PATH ?? DEFAULT_CHECKPOINT_PATH;

export class LocalDisclosureCheckpointStore {
  constructor(readonly checkpointPath = resolveCheckpointPath()) {}

  read(corpCode: string): string | null {
    return this.loadState().disclosures[corpCode] ?? null;
  }

  write(corpCode: string, latestDisclosureId: string): void {
    const nextState = this.loadState();
    nextState.disclosures[corpCode] = latestDisclosureId;
    this.saveState(nextState);
  }

  delete(corpCode: string): void {
    const nextState = this.loadState();
    delete nextState.disclosures[corpCode];
    this.saveState(nextState);
  }

  private loadState(): DisclosureCheckpointState {
    if (!existsSync(this.checkpointPath)) {
      return createEmptyState();
    }

    try {
      const raw = readFileSync(this.checkpointPath, "utf-8");
      const parsed = JSON.parse(raw) as DisclosureCheckpointState;

      if (!parsed || typeof parsed !== "object" || typeof parsed.disclosures !== "object") {
        return createEmptyState();
      }

      return {
        disclosures: parsed.disclosures
      };
    } catch {
      return createEmptyState();
    }
  }

  private saveState(state: DisclosureCheckpointState): void {
    mkdirSync(getParentDirectory(this.checkpointPath), { recursive: true });
    writeFileSync(this.checkpointPath, JSON.stringify(state, null, 2), "utf-8");
  }
}
