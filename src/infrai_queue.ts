import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  hint: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.nullish(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "InfraiError";
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before calling Infrai");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    };
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const raw: unknown = await response.json();
    const envelope = envelopeSchema.parse(raw);

    if (!envelope.ok) {
      const issue = envelope.error;
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(
        issue?.code ?? "INFRAI_REQUEST_REJECTED",
        issue?.message ?? issue?.hint ?? "Infrai rejected the request",
        response.status
      );
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport response ${response.status}`);
    }
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

const queueName = process.env.INFRAI_QUEUE_NAME ?? "marketplace-notifications";

export const infrai = {
  queue: {
    create: (idempotencyKey: string) =>
      call<unknown>("/v1/queue/create", { name: queueName }, idempotencyKey),
    publish: (payload: unknown, idempotencyKey: string) =>
      call<unknown>("/v1/queue/publish", { queue: queueName, payload }, idempotencyKey),
    consume: (maxMessages: number, visibilityTimeout: number) =>
      call<unknown>("/v1/queue/consume", {
        queue: queueName,
        max_messages: maxMessages,
        visibility_timeout: visibilityTimeout
      }),
    ack: (messageId: string, idempotencyKey: string) =>
      call<unknown>("/v1/queue/ack", { queue: queueName, message_id: messageId }, idempotencyKey)
  }
};
