declare const process: {
  argv: string[];
  cwd(): string;
  env: Record<string, string | undefined>;
};

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

declare module "node:url" {
  function fileURLToPath(url: string | URL): string;
  export { fileURLToPath };
}
