import { solarChatTool } from "../tools/chatWithSolar.js";

type ParsedArgs = {
  prompt?: string;
  systemPrompt?: string;
  traceId?: string;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--prompt":
        parsed.prompt = next;
        index += 1;
        break;
      case "--system":
        parsed.systemPrompt = next;
        index += 1;
        break;
      case "--trace-id":
        parsed.traceId = next;
        index += 1;
        break;
      default:
        break;
    }
  }

  return parsed;
};

export const main = async (argv = process.argv.slice(2)): Promise<number> => {
  const parsed = parseArgs(argv);
  if (!parsed.prompt) {
    console.error("prompt가 필요합니다. --prompt 로 전달하세요.");
    return 1;
  }

  const result = await solarChatTool.invoke({
    prompt: parsed.prompt,
    systemPrompt: parsed.systemPrompt,
    traceId: parsed.traceId,
    contractVersion: "v1"
  });

  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
};

if (process.argv[1]?.endsWith("runSolarChat.js")) {
  main().then((code) => {
    process.exitCode = code;
  });
}
