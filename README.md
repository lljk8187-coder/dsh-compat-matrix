# dsh-compat-matrix

在**指定 dsh 版本**上，对插件跑通 **install → dump hang-layer → lite load**，产出兼容性矩阵。

> **重要：dump ≠ 真实 boot / lite schema ≠ 全量 boot。** hang-layer（`dsh --dump-config`）与 `load_ok`（`dsh --dump-config-schema`）都是轻量探测，不是完整 `dsh` 启动，也不是 `dsh web`。

## 定位（M3）

本仓库提供 TypeScript CLI。**M3** 支持对本地插件夹具做**三态探测**（临时 `DSH_HOME`）：

1. **install_ok** — `dsh plugin --profile <p> add <path>` exit 0  
2. **config_hang_ok** — `--dump-config` stdout 含 `# == <packageName>` hang-layer  
3. **load_ok** — 安装成功后跑 `--dump-config-schema` exit 0（lite load；安装失败则 `load_ok=false` 并跳过 schema）

整体成功（CLI exit 0）仅当三者皆 true；否则 exit ≠0，并设置 `error_stage`（`preflight` | `install` | `config_hang` | `load`）。**不**启动 `dsh web`，**不**写入真实 `~/.dsh`。

## 非目标（Non-goals）

- 应用商店 / 插件市场
- 自动修复（auto-fix）
- Oh-My-DSH 集成
- 对真实网络插件的压测 / hammering（无 real-net）
- **MatrixReport 落盘（M4）** / **targets 批量（M5）** / **CI workflow（M6）** — 尚未实现
- 真实全量 boot / `dsh web`

## 环境要求（probe）

| 依赖 | 说明 |
|------|------|
| **Node.js ≥ 22.19** | dsh 运行时要求（本仓库脚本可用 Node 20+ 跑 CLI，但跑 probe 必须满足 dsh） |
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
```

### 正/负向夹具探测

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"

# 正向：三态皆 true → exit 0
npx tsx src/cli.ts probe fixtures/hello-plugin

# 负向 no-bundle：install true, hang false → exit ≠0, error_stage=config_hang
npx tsx src/cli.ts probe fixtures/no-bundle-plugin

# 负向 bad-patch：install false → exit ≠0, error_stage=install
npx tsx src/cli.ts probe fixtures/bad-patch-plugin
```

stdout 为结构化 JSON（含 `install_ok` / `config_hang_ok` / `load_ok` / `error_stage?` / `duration_ms` 等）；stderr 一行摘要。

## CLI

| 命令 | 状态 | 说明 |
|------|------|------|
| `probe <path>` | **M3** | 临时 DSH_HOME：三态 install → hang → lite schema |
| `run` | stub（M4+/matrix） | 全量矩阵尚未实现 |
| `--help` / `help` | 可用 | 打印帮助 |

## 目录结构

```
src/
  cli.ts                 # CLI 入口
  runner/temp-home.ts    # 临时 DSH_HOME
  runner/dsh.ts          # resolve + run dsh
  probe/probe-local.ts   # 本地三态探测
  report/                # JSON / 摘要格式化
fixtures/hello-plugin/       # 正向夹具
fixtures/no-bundle-plugin/   # 负向：无 dsh.bundle
fixtures/bad-patch-plugin/   # 负向：无效 patch YAML
targets.example.json         # 目标配置示例（M5 消费）
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
npm test
```

- 帮助烟雾测试始终运行。
- 集成测试：若 PATH 上有 `dsh`，对三个夹具跑 probe 并断言三态；若无 dsh 则 **`t.skip('dsh not installed')`**，CI 友好。

## 开发脚本

```bash
npm run help       # 打印 CLI 帮助
npm run typecheck  # tsc --noEmit
npm test           # 帮助 +（有 dsh 时）三态 probe 集成测试
```

## 许可

MIT — 见 [LICENSE](./LICENSE)。

## 路线图提示

- **M1**：LICENSE、README、TS 脚手架、stub `probe` / `run`
- **M2**：本地夹具 + 临时 DSH_HOME + hang-layer
- **M3**（当前）：三态 probe + 正/负向夹具 + lite `load_ok`
- **M4**：MatrixReport 落盘
- **M5**：targets 批量
- **M6**：CI workflow
