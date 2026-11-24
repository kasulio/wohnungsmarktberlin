import { describe, expect, test } from "bun:test";
import { groupByRecipient } from "./recipients";

const at = (day: number) => new Date(Date.UTC(2026, 10, day));

describe("groupByRecipient", () => {
  test("one recipient per channel and target, with all its subscriptions", () => {
    const recipients = groupByRecipient(
      [
        {
          id: "a",
          channel: "telegram",
          target: "111",
          filter: null,
          active: true,
          source: "db",
          createdAt: at(18),
          sentCount: 5,
        },
        {
          id: "b",
          channel: "telegram",
          target: "222",
          filter: null,
          active: true,
          source: "db",
          createdAt: at(17),
          sentCount: 1,
        },
        {
          id: "c",
          channel: "telegram",
          target: "111",
          filter: { roomsMin: 2 },
          active: true,
          source: "db",
          createdAt: at(16),
          sentCount: 3,
        },
      ],
      [
        {
          channel: "telegram",
          target: "111",
          delivered: 6,
          lastSentAt: at(20),
        },
      ],
    );

    expect(recipients).toHaveLength(2);
    const first = recipients[0]!;
    expect(first.target).toBe("111");
    expect(first.subscriptions.map((s) => s.id)).toEqual(["c", "a"]);
    expect(first.createdAt).toEqual(at(16));
    expect(first.delivered).toBe(6);
    expect(first.lastSentAt).toEqual(at(20));
    expect(recipients[1]!.delivered).toBe(0);
    expect(recipients[1]!.lastSentAt).toBeNull();
  });

  test("a recipient is active if any subscription is, and active ones come first", () => {
    const recipients = groupByRecipient(
      [
        {
          id: "stopped",
          channel: "telegram",
          target: "1",
          filter: null,
          active: false,
          source: "db",
          createdAt: at(1),
          sentCount: 0,
        },
        {
          id: "mixed-off",
          channel: "telegram",
          target: "2",
          filter: null,
          active: false,
          source: "db",
          createdAt: at(2),
          sentCount: 0,
        },
        {
          id: "mixed-on",
          channel: "telegram",
          target: "2",
          filter: null,
          active: true,
          source: "db",
          createdAt: at(3),
          sentCount: 0,
        },
      ],
      [],
    );

    expect(recipients.map((r) => [r.target, r.active])).toEqual([
      ["2", true],
      ["1", false],
    ]);
  });

  test("people come before code-defined hooks, however much the hooks sent", () => {
    const recipients = groupByRecipient(
      [
        {
          id: "log:all",
          channel: "log",
          target: "all",
          filter: null,
          active: true,
          source: "static",
          createdAt: at(1),
          sentCount: 50,
        },
        {
          id: "t",
          channel: "telegram",
          target: "1",
          filter: null,
          active: true,
          source: "db",
          createdAt: at(1),
          sentCount: 2,
        },
      ],
      [
        { channel: "log", target: "all", delivered: 50, lastSentAt: at(2) },
        { channel: "telegram", target: "1", delivered: 2, lastSentAt: at(2) },
      ],
    );

    expect(recipients.map((r) => r.target)).toEqual(["1", "all"]);
  });
});
