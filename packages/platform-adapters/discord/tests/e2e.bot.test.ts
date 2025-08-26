import { Client, Events, GatewayIntentBits, Partials, Message } from "discord.js";
import { normalizeMessageCreated, normalizeMessageUpdated } from "../src/normalizers";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env from infra folder
config({ path: resolve(__dirname, "../../../../infra/.env"), override: true });

// Opt-in E2E: requires DISCORD_E2E=1 and DISCORD_BOT_TOKEN to be set.
const enabled = process.env.DISCORD_E2E === "1" && !!process.env.DISCORD_BOT_TOKEN;

(enabled ? describe : describe.skip)("e2e: discord bot connection", () => {
  test(
    "connects and logs normalized messages",
    async () => {
      const token = process.env.DISCORD_BOT_TOKEN as string;
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.DirectMessageReactions,
        ],
        partials: [Partials.Message, Partials.Channel, Partials.Reaction],
      });

      client.on(Events.MessageCreate, async (message: Message) => {
        const payload = normalizeMessageCreated(message);
        // eslint-disable-next-line no-console
        console.log("E2E MessageCreate", payload.externalId, payload.content);
      });

      client.on(Events.MessageUpdate, async (_old, newMessage) => {
        const message = newMessage.partial ? await newMessage.fetch() : newMessage;
        const payload = normalizeMessageUpdated(message);
        // eslint-disable-next-line no-console
        console.log("E2E MessageUpdate", payload.externalId, payload.editedAt);
      });

      await client.login(token);

      // wait a short period to observe events
      await new Promise((res) => setTimeout(res, 5000));

      await client.destroy();
      expect(client).toBeTruthy();
    },
    30000
  );
});


