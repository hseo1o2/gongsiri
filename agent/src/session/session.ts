import type { ContractVersion } from "../contracts/request.js";
import { loadLocalEnvFiles } from "../env/loadLocalEnv.js";

export type SolarConfig = {
  apiKey: string | null;
  model: string | null;
};

export type AgentSessionContext = {
  traceId: string;
  contractVersion: ContractVersion;
  pythonBin: string;
  solar: SolarConfig;
};

export const resolveContractVersion = (): ContractVersion => "v2";

export const resolveSolarConfig = (): SolarConfig => ({
  apiKey: process.env.UPSTAGE_API_KEY ?? null,
  model: process.env.UPSTAGE_MODEL ?? null,
});

export const createSessionContext = (
  traceId: string,
  contractVersion: ContractVersion = resolveContractVersion(),
  pythonBin = process.env.PYTHON_BIN ?? "python3",
): AgentSessionContext => ({
  traceId,
  contractVersion,
  pythonBin,
  solar: resolveSolarConfig(),
});

loadLocalEnvFiles();
