import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MATRIX_DUMP_NOTE,
  buildMatrixReport,
  formatMatrixReportJson,
  formatMatrixReportMd,
  probeResultToRow,
} from "../src/report/index.js";

describe("MatrixReport builders (no dsh)", () => {
  it("builds JSON with required keys and MD table + dump≠boot note", () => {
    const fakeProbes = [
      {
        pluginPath: "/abs/fixtures/hello-plugin",
        packageName: "@demo/hello-plugin",
        install_ok: true,
        config_hang_ok: true,
        load_ok: true,
        duration_ms: 120,
      },
      {
        pluginPath: "/abs/fixtures/no-bundle-plugin",
        packageName: "@demo/no-bundle-plugin",
        install_ok: true,
        config_hang_ok: false,
        load_ok: true,
        error_stage: "config_hang",
        duration_ms: 80,
        error: "hang-layer marker not found",
      },
      {
        pluginPath: "/abs/fixtures/bad-patch-plugin",
        packageName: "@demo/bad-patch-plugin",
        install_ok: false,
        config_hang_ok: false,
        load_ok: false,
        error_stage: "install",
        duration_ms: 40,
        error: "dsh plugin add exited 1",
      },
    ] as const;

    const rows = [
      probeResultToRow("fixtures/hello-plugin", fakeProbes[0]),
      probeResultToRow("fixtures/no-bundle-plugin", fakeProbes[1]),
      probeResultToRow("fixtures/bad-patch-plugin", fakeProbes[2]),
    ];

    const report = buildMatrixReport({
      generated_at: "2026-09-29T06:00:00.000Z",
      dshVersion: "dsh 0.1.7-rc.2",
      note: MATRIX_DUMP_NOTE,
      rows,
    });

    const json = formatMatrixReportJson(report);
    const parsed = JSON.parse(json) as typeof report;
    assert.equal(parsed.generated_at, "2026-09-29T06:00:00.000Z");
    assert.equal(parsed.dshVersion, "dsh 0.1.7-rc.2");
    assert.ok(parsed.note?.includes("dump ≠ boot"));
    assert.equal(parsed.rows.length, 3);
    assert.equal(parsed.rows[0]!.plugin, "fixtures/hello-plugin");
    assert.equal(parsed.rows[0]!.install_ok, true);
    assert.equal(parsed.rows[0]!.path, "/abs/fixtures/hello-plugin");
    assert.equal(parsed.rows[1]!.error_stage, "config_hang");
    assert.equal(parsed.rows[2]!.load_ok, false);

    const md = formatMatrixReportMd(report);
    assert.match(md, /dump ≠ boot/);
    assert.match(md, /\| 插件 \| install \| hang \| load \| stage \| ms \|/);
    assert.match(md, /fixtures\/hello-plugin/);
    assert.match(md, /fixtures\/no-bundle-plugin/);
    assert.match(md, /fixtures\/bad-patch-plugin/);
    assert.match(md, /summary:/);
  });
});
