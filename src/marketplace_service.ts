import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { marketplaceUpdateSchema, planFanout } from "./fanout_plan.js";
import { InfraiError, infrai } from "./infrai_queue.js";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function publishMarketplaceUpdate(input: unknown): Promise<{ queued: number }> {
  const update = marketplaceUpdateSchema.parse(input);
  const notifications = planFanout(update);

  await Promise.all(notifications.map((notification) =>
    infrai.queue.publish(
      notification,
      `marketplace:${notification.eventId}:${notification.buyerId}`
    )
  ));

  return { queued: notifications.length };
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/marketplace/updates") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    json(response, 202, await publishMarketplaceUpdate(await readBody(request)));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid marketplace update" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "Unable to queue marketplace update" });
  }
});

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Marketplace route listening on ${port}`));
}
