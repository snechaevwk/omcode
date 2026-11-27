import {
  ModelSelection,
  type OrchestrationV2ThreadShell,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import { runMigrations } from "../persistence/Migrations.ts";
import type { RateTable } from "../usage/usagePricing.ts";
import * as ThreadUsage from "./ThreadUsage.ts";

const layer = it.layer(NodeSqliteClient.layer({ filename: ":memory:" }));

const record = (overrides: Partial<ThreadUsage.TurnUsageRecord> = {}) => ({
  model: "test-model",
  inputTokens: 1_000,
  cachedInputTokens: 400,
  cacheCreationTokens: 100,
  outputTokens: 200,
  reasoningTokens: 50,
  ...overrides,
});

const shellFor = (threadId: ThreadId) =>
  ({
    id: threadId,
    modelSelection: ModelSelection.make({
      instanceId: ProviderInstanceId.make("codex"),
      model: "thread-model",
    }),
  }) as OrchestrationV2ThreadShell;

layer("makeShellUsageEnricher", (it) => {
  it.effect("sums each thread's provider turns, taking the model from the turn's run", () =>
    Effect.gen(function* () {
      yield* runMigrations();
      const sql = yield* SqlClient.SqlClient;
      const threadId = ThreadId.make("thread-usage");
      const usage = (output: number) =>
        JSON.stringify({
          turnTokenUsage: {
            usageStatus: "complete",
            usageScope: "main_agent",
            hasSubagents: false,
            inputTokens: 1_000,
            cachedInputTokens: 400,
            outputTokens: output,
          },
        });
      yield* sql`
        INSERT INTO orchestration_v2_projection_runs
          (run_id, thread_id, ordinal, provider, status, requested_at, payload_json)
        VALUES ('run-1', ${threadId}, 1, 'codex', 'completed', '2026-01-01',
          '{"modelSelection":{"instanceId":"codex","model":"run-model"}}')
      `;
      yield* sql`
        INSERT INTO orchestration_v2_projection_run_attempts
          (attempt_id, thread_id, run_id, attempt_ordinal, root_node_id, provider,
           provider_thread_id, status, payload_json)
        VALUES ('attempt-1', ${threadId}, 'run-1', 1, 'node-1', 'codex', 'pt-1', 'completed', '{}')
      `;
      yield* sql`
        INSERT INTO orchestration_v2_projection_provider_turns
          (provider_turn_id, thread_id, provider_thread_id, node_id, run_attempt_id, ordinal,
           status, payload_json)
        VALUES
          ('turn-1', ${threadId}, 'pt-1', 'node-1', 'attempt-1', 1, 'completed', ${usage(200)}),
          ('turn-2', ${threadId}, 'pt-1', 'node-2', NULL, 2, 'completed', ${usage(300)}),
          ('turn-3', ${threadId}, 'pt-1', 'node-3', NULL, 3, 'running', '{}')
      `;

      const enricher = yield* ThreadUsage.makeShellUsageEnricher;
      const shell = yield* enricher.enrichShell(shellFor(threadId));
      assert.deepStrictEqual(shell?.usage, {
        turns: 2,
        inputTokens: 2_000,
        cachedInputTokens: 800,
        outputTokens: 500,
        reasoningTokens: 0,
        estimatedCostUsd: null,
        unpricedTurns: 2,
      });

      const untouched = yield* enricher.enrichShell(shellFor(ThreadId.make("no-turns")));
      assert.strictEqual(untouched?.usage, undefined);
    }),
  );
});

it("prices each turn from uncached, cached, cache-write and output tokens", () => {
  const rates: RateTable = new Map([
    [
      "test-model",
      {
        inputCostPerToken: 1,
        outputCostPerToken: 10,
        cacheReadCostPerToken: 0.1,
        cacheCreationCostPerToken: 2,
        cacheCreation1hCostPerToken: 2,
        fast: null,
        ultrafast: null,
        contextTiers: [],
      },
    ],
  ]);
  const summary = ThreadUsage.summarizeTurnUsage([record(), record({ model: "unknown" })], {
    rates,
    overrides: new Map(),
  });
  // 500 uncached + 400 * 0.1 cached + 100 * 2 written + 200 * 10 output.
  assert.strictEqual(summary.estimatedCostUsd, 500 + 40 + 200 + 2_000);
  assert.strictEqual(summary.unpricedTurns, 1);
  assert.strictEqual(summary.turns, 2);
});

it("skips turns that reported no totals", () => {
  assert.strictEqual(
    ThreadUsage.turnUsageRecordFromJson('{"usageStatus":"unavailable"}', "model"),
    null,
  );
});
