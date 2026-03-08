/**
 * LLM helper using the OpenAI API directly.
 * Requires OPENAI_API_KEY environment variable.
 */

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type InvokeLLMOptions = {
  messages: Message[];
  response_format?: {
    type: string;
    json_schema?: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  model?: string;
};

type LLMResponse = {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
};

export async function invokeLLM(options: InvokeLLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = options.model || "gpt-4o-mini";

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };

  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<LLMResponse>;
}
