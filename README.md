# dsh-compat-matrix

在**指定 dsh 版本**上，对插件跑通 **install → dump hang-layer → light load**，产出兼容性矩阵。

> **重要：dump ≠ 真实 boot。** hang-layer dump 不是完整 dsh 启动，仅用于轻量兼容探测。

## 定位（M1）

本仓库提供 TypeScript CLI 脚手架与目录约定。当前为 **M1**：文档、脚手架、占位模块与 stub 子命令；**不调用真实 dsh**。

## 非目标（Non-goals）

- 应用商店 / 插件市场
- 自动修复（auto-fix）
- Oh-My-DSH 集成
- 对真实网络的压测 / hammering

## 快速开始

需要 Node.js ≥ 20。使用 **npm**（M1 不强制 pnpm）。

```bash
npm install
npx tsx src/cli.ts --help
# 或
npm run help
```

## CLI（M1 stubs）

| 命令 | 状态 | 说明 |
|------|------|------|
| `probe` | stub（M2+） | 探测插件相对某 dsh 版本的兼容性 |
| `run`   | stub（M2+） | 跑 install → dump hang-layer → light load 矩阵 |
| `--help` / `help` | 可用 | 打印帮助 |

## 目录结构

```
src/
  cli.ts          # CLI 入口
  cli/            # CLI 辅助（占位）
  runner/         # 运行流水线（占位，M2+）
  probe/          # 探测逻辑（占位，M2+）
  report/         # 矩阵报告（占位，M2+）
fixtures/         # 测试夹具占位
targets.example.json  # 目标配置示例
```

## `targets.example.json`

示例字段（复制为 `targets.json` 后按需修改；M2 才会真正消费）：

| 字段 | 含义 |
|------|------|
| `dshVersion` | 要探测的 dsh 版本（占位字符串） |
| `plugins[].id` | 插件标识 |
| `plugins[].source` | 来源（如 npm 包说明） |
| `plugins[].notes` | 备注 |

## 开发脚本

```bash
npm run help       # 打印 CLI 帮助
npm run typecheck  # tsc --noEmit
npm test           # 帮助输出烟雾测试（node:test）
```

## 许可

MIT — 见 [LICENSE](./LICENSE)。

## 路线图提示

- **M1**（当前）：LICENSE、README、TS 脚手架、stub `probe` / `run`
- **M2+**：真实 dsh 探测与矩阵产出（本里程碑不实现）
