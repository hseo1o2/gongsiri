declare const process: {
  argv: string[];
  cwd(): string;
  env: Record<string, string | undefined>;
  exitCode?: number;
};

declare const console: {
  log(message?: unknown, ...optionalParams: unknown[]): void;
  error(message?: unknown, ...optionalParams: unknown[]): void;
};

declare function setInterval(handler: () => void, timeout?: number): number;
declare function clearInterval(handle?: number): void;

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
};

declare function fetch(
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<FetchResponse>;

declare module "node:child_process" {
  type ExecFileError = Error & {
    code?: number | string | null;
  };

  type ExecFileCallback = (
    error: ExecFileError | null,
    stdout: string,
    stderr: string
  ) => void;

  type ExecFileOptions = {
    cwd?: string;
    env?: Record<string, string | undefined>;
    maxBuffer?: number;
  };

  function execFile(
    file: string,
    args: readonly string[],
    options: ExecFileOptions,
    callback: ExecFileCallback
  ): void;

  export { execFile };
}

declare module "node:fs" {
  function existsSync(path: string): boolean;
  function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  function readFileSync(path: string, options?: { encoding?: string } | string): string;
  function writeFileSync(
    path: string,
    data: string,
    options?: { encoding?: string } | string
  ): void;

  export { existsSync, mkdirSync, readFileSync, writeFileSync };
}

declare module "node:url" {
  function fileURLToPath(url: string | URL): string;
  export { fileURLToPath };
}

declare module "node:path" {}
