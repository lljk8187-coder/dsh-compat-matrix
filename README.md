# dsh-compat-matrix

在**指定 dsh 版本**上，对插件跑通 **install → dump hang-layer → lite load**，产出兼容性矩阵。

> **重要：dump ≠ 真实 boot / lite schema ≠ 全量 boot。** hang-layer（`dsh --dump-config`）与 `load_ok`（`dsh --dump-config-schema`）都是轻量探测，不是完整 `dsh` 启动，也不是 `dsh web`。

## 定位（Phase1 MVP / M6 收口）

本仓库提供 TypeScript CLI。**Phase1 MVP `0.1.0`** 已收口 **M1–M6**：

1. **install_ok** — `dsh plugin --profile <p> add <path>` exit 0  
2. **config_hang_ok** — `--dump-config` stdout 含 `# == <packageName>` hang-layer  
3. **load_ok** — 安装成功后跑 `--dump-config-schema` exit 0（lite load；安装失败则 `load_ok=false` 并跳过 schema）

整体成功（CLI exit 0）仅当三者皆 true（`run` 则要求**每一行**皆 true）；否则 exit ≠0，并设置 `error_stage`（`preflight` | `install` | `config_hang` | `load`）。

默认夹具 / `targets.example.json` 含负向用例时，`run` **预期 exit ≠0**（属正常）。

## 护栏 / Guardrails

- **dump ≠ boot**：lite load = `dump-config-schema`；hang-layer = `dump-config` — 均非真实全量 boot
- **临时 DSH_HOME only**：probe / run 只用临时目录，**不写** `~/.dsh`
- **不启 web / 不全量 boot**：不启动 `dsh web`，不做完整 runtime boot
- **非目标**：商店 / 自动修 / Oh-My-DSH / 真网压测
- **CI 仅 fixture**：无真网插件矩阵；defaults / examples 仅本地夹具与 `targets.example.json`

## 非目标（Non-goals）

- 应用商店 / 插件市场
- 自动修复（auto-fix）
- Oh-My-DSH 集成
- 对真实网络插件的压测 / hammering（无 real-net / 真网；defaults/examples 不含 npm 真网插件）
- 真实全量 boot / `dsh web`
- 按 targets.`dshVersion` 切换 dsh 二进制（该字段仅文档）
- 多版本 dsh 二进制切换 / web profile

## 环境要求（probe / run）

| 依赖 | 说明 |
|------|------|
| **Node.js ≥ 22.19** | dsh 运行时要求（本仓库脚本可用 Node 20+ 跑 CLI，但跑 probe/run 必须满足 dsh） |
| **dsh** | `npm install -g @deepseek-ai/dsh`（当前验证：`@deepseek-ai/dsh@0.1.7-rc.2`） |
| **pnpm** | `npm install -g pnpm`（`dsh plugin add` 内部使用） |

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"
which dsh && dsh --version
```

## 快速开始

```bash
npm install
npx tsx src/cli.ts --help
npx tsx src/cli.ts --version   # 0.1.0 (Phase1 MVP)
```

### 矩阵 `run`（默认夹具 / targets）

串行探测，始终写出 `report.json` + `report.md`（即便部分失败）：

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"

# 默认三夹具（无 --targets）
npx tsx src/cli.ts run --out-dir ./out
# 也支持: npx tsx src/cli.ts run --out-dir=./out

# 从 targets 文件串行批量（按 listed order）
npx tsx src/cli.ts run --targets targets.example.json --out-dir ./out-m5
# 也支持: --targets=targets.example.json --out-dir=./out-m5
```

样例路径：

- `out/report.json` — pretty JSON（indent 2）
- `out/report.md` — Markdown 表：插件 | install | hang | load | stage | ms；顶部注明 **dump ≠ boot**

默认夹具（无 `--targets`，固定顺序）：

1. `fixtures/hello-plugin`
2. `fixtures/no-bundle-plugin`
3. `fixtures/bad-patch-plugin`

### targets 文件

见 [`targets.example.json`](./targets.example.json)：

```json
{
  "dshVersion": "0.1.7-rc.2",
  "plugins": [
    { "id": "hello", "path": "fixtures/hello-plugin" },
    { "id": "no-bundle", "path": "fixtures/no-bundle-plugin" },
    { "id": "bad-patch", "path": "fixtures/bad-patch-plugin" }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `plugins[].path` | **必填**：本地插件路径（相对 cwd 或绝对） |
| `plugins[].id` | 可选但推荐：用作 `MatrixRow.plugin` 标签；缺省则用 path |
| `dshVersion` | 可选文档字段；**不**切换 dsh 二进制；报告仍用 live `getDshVersion()` |
| `plugins` | 不可为空；缺 path / 空数组 → 清晰 Error |

仅支持本地 path 插件（本里程碑）；无 npm / 真网默认。

### 单插件 `probe`

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"

# 正向：三态皆 true → exit 0
npx tsx src/cli.ts probe fixtures/hello-plugin

# 负向 no-bundle：install true, hang false → exit ≠0, error_stage=config_hang
npx tsx src/cli.ts probe fixtures/no-bundle-plugin

# 负向 bad-patch：install false → exit ≠0, error_stage=install
npx tsx src/cli.ts probe fixtures/bad-patch-plugin
```

stdout 为结构化 JSON；stderr 一行摘要。

## CLI

| 命令 | 状态 | 说明 |
|------|------|------|
| `probe <path>` | **M3** | 临时 DSH_HOME：三态 install → hang → lite schema |
| `run [--out-dir ./out]` | **M4** | 默认夹具串行探测 → `report.json` + `report.md` |
| `run --targets <file> [--out-dir ./out]` | **M5** | targets 串行批量；支持 `--targets=` / `--out-dir=` |
| `--help` / `help` | 可用 | 打印帮助 |
| `--version` / `-V` | 可用 | `0.1.0 (Phase1 MVP)` |

## 目录结构

```
src/
  cli.ts                 # CLI 入口
  runner/temp-home.ts    # 临时 DSH_HOME
  runner/dsh.ts          # resolve + run dsh
  runner/run-matrix.ts   # run 编排（M4/M5）
  runner/targets.ts      # targets 加载 / 校验（M5）
  probe/probe-local.ts   # 本地三态探测
  report/                # probe 格式化 + MatrixReport 落盘
fixtures/hello-plugin/       # 正向夹具
fixtures/no-bundle-plugin/   # 负向：无 dsh.bundle
fixtures/bad-patch-plugin/   # 负向：无效 patch YAML
out/                         # run 输出（gitignore）
targets.example.json         # 目标配置示例（本地三夹具）
.github/workflows/ci.yml     # CI（M6）
CHANGELOG.md                 # 版本说明
```

## 夹具摘要

详见 [fixtures/README.md](./fixtures/README.md)。

| Fixture | Expected |
|---------|----------|
| `hello-plugin` | 三态 true |
| `no-bundle-plugin` | install true, hang false, `error_stage=config_hang` |
| `bad-patch-plugin` | install false, `error_stage=install` |

## 测试与 CI

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"
npm run typecheck
npm test
```

- GitHub Actions：[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) — `push` / `pull_request` → `main`；Node 22；`npm ci` → typecheck → best-effort 安装 dsh+pnpm（失败不阻塞）→ `npm test`
- 帮助烟雾测试始终运行。
- MatrixReport 单元测试（无 dsh）：假 Probe → JSON keys + MD 表头 / dump≠boot / 插件名。
- targets 单元：解析 `targets.example.json`；拒绝坏 JSON / 空 plugins / 缺 path。
- 集成测试：若 PATH 上有 `dsh`，对夹具跑 probe / `run` / `run --targets` 烟雾；若无 dsh 则 **`t.skip('dsh not installed')`**，CI 友好。
- **仅 fixture**；无真网插件矩阵。

## 开发脚本

```bash
npm run help       # 打印 CLI 帮助
npm run typecheck  # tsc --noEmit
npm test           # 帮助 + MatrixReport + targets +（有 dsh 时）probe/run 集成
```

## 版本

- **package / CLI**：`0.1.0`（Phase1 MVP）
- 详见 [CHANGELOG.md](./CHANGELOG.md)

## 许可

MIT — 见 [LICENSE](./LICENSE)。

## 路线图

- [x] **M1**：LICENSE、README、TS 脚手架、stub `probe` / `run`
- [x] **M2**：本地夹具 + 临时 DSH_HOME + hang-layer
- [x] **M3**：三态 probe + 正/负向夹具 + lite `load_ok`
- [x] **M4**：MatrixReport 落盘 + CLI `run`
- [x] **M5**：targets 串行批量
- [x] **M6**：CI workflow + 文档护栏 / Phase1 MVP 收口（当前）
