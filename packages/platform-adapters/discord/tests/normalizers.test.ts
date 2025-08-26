import { normalizeMessageCreated, normalizeMessageUpdated } from "../src/normalizers";

// Minimal fakes for discord.js Message
function fakeMessage(overrides: Partial<any> = {}) {
  const createdAt = new Date("2024-01-01T00:00:00Z");
  const editedAt = new Date("2024-01-01T01:00:00Z");
  return {
    id: "123",
    guild: { id: "guild-1" },
    guildId: "guild-1",
    channelId: "channel-1",
    author: { id: "user-1", username: "alice", bot: false },
    content: "hello",
    attachments: new Map(
      Object.entries({
        a1: { id: "a1", url: "https://cdn/1.png", contentType: "image/png" }
      })
    ),
    createdAt,
    editedAt,
    channel: { id: "channel-1", isThread: () => false },
    ...overrides,
  };
}

describe("normalizers", () => {
  test("normalizeMessageCreated maps base fields", () => {
    const m = fakeMessage();
    const out = normalizeMessageCreated(m as any);
    expect(out.externalId).toBe("123");
    expect(out.guildId).toBe("guild-1");
    expect(out.channelId).toBe("channel-1");
    expect(out.author.id).toBe("user-1");
    expect(out.content).toBe("hello");
    expect(out.attachments?.[0]).toEqual({ id: "a1", url: "https://cdn/1.png", contentType: "image/png" });
    expect(out.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(out.link).toContain("discord.com/channels/guild-1/channel-1/123");
  });

  test("normalizeMessageUpdated maps edited fields", () => {
    const m = fakeMessage({ previousContent: "old" });
    const out = normalizeMessageUpdated(m as any);
    expect(out.externalId).toBe("123");
    expect(out.editedAt).toBe("2024-01-01T01:00:00.000Z");
    expect(out.previousContent).toBe("old");
  });

  test("threadId included when thread channel", () => {
    const m = fakeMessage({ channel: { id: "thread-1", isThread: () => true } });
    const out = normalizeMessageCreated(m as any);
    expect(out.threadId).toBe("thread-1");
  });
});


