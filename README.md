# dsh-compat-matrix

在**指定 dsh 版本**上，对插件跑通 **install → dump hang-layer → light load**，产出兼容性矩阵。

> **重要：dump ≠ 真实 boot。** hang-layer dump（`dsh --dump-config`）不是完整 dsh 启动，仅用于轻量兼容探测。M2 的 `load_ok` 为 stub（skipped）。

## 定位（M2）

本仓库提供 TypeScript CLI。**M2** 支持对本地插件夹具做隔离探测：在**临时 `DSH_HOME`** 上执行 `dsh plugin add`，再用 `--dump-config` 检查 hang-layer（例如 `# == dsh-hello-plugin`）。**不**启动 `dsh web`，**不**写入真实 `~/.dsh`。

## 非目标（Non-goals）

- 应用商店 / 插件市场
- 自动修复（auto-fix）
- Oh-My-DSH 集成
- 对真实网络的压测 / hammering
- M3 全量矩阵 / M4 完整报告文件 / M5 批量 targets（尚未实现）

## 环境要求（probe）

| 依赖 | 说明 |
|------|------|
| **Node.js ≥ 22.19** | dsh 运行时要求（本仓库脚本可用 Node 20+ 跑 CLI，但跑 probe 必须满足 dsh） |
| **dsh** | `npm install -g @deepseek-ai/dsh`（当前验证：`@deepseek-ai/dsh@0.1.7-rc.2`） |
| **pnpm** | `npm install -g pnpm`（`dsh plugin add` 内部使用） |

确保 PATH 能找到 node22 与全局 bin，例如：

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"
which dsh && dsh --version
```

> Git 源安装插件时，pnpm 可能需要 `allowBuilds`；本仓库的 **hello-plugin 是本地路径链接**，通常不涉及。

## 快速开始

```bash
npm install
npx tsx src/cli.ts --help
```

### 探测 hello-plugin 夹具

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"
npx tsx src/cli.ts probe fixtures/hello-plugin
# 或绝对路径
npx tsx src/cli.ts probe "$(pwd)/fixtures/hello-plugin"
```

成功时 stdout 为结构化 JSON（含 `install_ok`、`config_hang_ok`、临时 `dshHome`、`profile`、`load_ok` stub 等），exit 0；失败 exit 非 0。stderr 有一行人类可读摘要。

## CLI

| 命令 | 状态 | 说明 |
|------|------|------|
| `probe <path>` | **M2** | 临时 DSH_HOME：`plugin add` → `--dump-config` hang-layer |
| `run` | stub（M3+） | 全量矩阵尚未实现 |
| `--help` / `help` | 可用 | 打印帮助 |

## 目录结构

```
src/
  cli.ts                 # CLI 入口
  runner/temp-home.ts    # 临时 DSH_HOME
  runner/dsh.ts          # resolve + run dsh
  probe/probe-local.ts   # 本地插件探测
  report/                # JSON / 摘要格式化
fixtures/hello-plugin/   # 最小官方形态插件夹具
targets.example.json     # 目标配置示例（M3+ 消费）
```

## `fixtures/hello-plugin`

最小官方形态：

- `package.json` — `name: dsh-hello-plugin`，`dsh.bundle.patch` → `./cordis.patch.yml`
- `cordis.patch.yml` — insert hang-layer
- `index.js` — `export name` + `apply()`

详见 [fixtures/README.md](./fixtures/README.md)。

## 测试与 CI

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"
npm test
```

- 帮助烟雾测试始终运行。
- 集成测试：若 PATH 上有 `dsh`，对 `fixtures/hello-plugin` 跑 probe 并断言 `install_ok` + `config_hang_ok`；若无 dsh 则 **`t.skip('dsh not installed')`**，CI 可在未安装 dsh 的环境跳过。

## 开发脚本

```bash
npm run help       # 打印 CLI 帮助
npm run typecheck  # tsc --noEmit
npm test           # 帮助 +（有 dsh 时）probe 集成测试
```

## 许可

MIT — 见 [LICENSE](./LICENSE)。

## 路线图提示

- **M1**：LICENSE、README、TS 脚手架、stub `probe` / `run`
- **M2**（当前）：本地夹具 + 临时 DSH_HOME + `probe` hang-layer
- **M3+**：全量矩阵、`run`、报告文件、批量 targets
