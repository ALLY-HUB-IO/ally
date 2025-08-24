import { DiscordMessageCreated, DiscordMessageUpdated } from "../src/schemas";

describe("Discord schemas", () => {
  test("validates message.created", () => {
    const payload = {
      externalId: "123",
      guildId: null,
      channelId: "456",
      threadId: null,
      author: { id: "u1", username: "bob" },
      content: "hello",
      attachments: [{ id: "a1", url: "http://x", contentType: null }],
      link: "http://example",
      createdAt: new Date().toISOString(),
    };
    const parsed = DiscordMessageCreated.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  test("rejects created without content", () => {
    const payload = {
      externalId: "123",
      channelId: "456",
      author: { id: "u1" },
      content: 5 as unknown as string,
      createdAt: new Date().toISOString(),
    } as any;
    const parsed = DiscordMessageCreated.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  test("validates message.updated", () => {
    const payload = {
      externalId: "123",
      channelId: "456",
      author: { id: "u1" },
      content: "hello",
      editedAt: new Date().toISOString(),
      previousContent: "hi",
    };
    const parsed = DiscordMessageUpdated.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});


