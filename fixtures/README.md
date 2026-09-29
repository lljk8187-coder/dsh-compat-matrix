# fixtures/

Sample plugins for local three-state probes (M3): **install → hang-layer → lite schema load**.

| Fixture | Expected |
|---------|----------|
| `hello-plugin` | `install_ok=true`, `config_hang_ok=true`, `load_ok=true` (exit 0) |
| `no-bundle-plugin` | `install_ok=true`, `config_hang_ok=false`, `error_stage=config_hang` (exit ≠0); dsh warns "declares no dsh.bundle" |
| `bad-patch-plugin` | `install_ok=false`, hang/load false, `error_stage=install` (exit ≠0); dsh "installation rejected" / YAMLException |

> **dump ≠ 全量 boot.** `--dump-config` and `--dump-config-schema` are lite checks, not a real `dsh` boot / `dsh web`.

## hello-plugin (positive)

Minimal official-shape dsh plugin:

```
fixtures/hello-plugin/
  package.json      # name: dsh-hello-plugin, dsh.bundle.patch → ./cordis.patch.yml
  cordis.patch.yml  # inserts hang-layer id `hello` / name `dsh-hello-plugin`
  index.js          # export name + apply()
```

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"
npx tsx src/cli.ts probe fixtures/hello-plugin   # expect exit 0
```

Success: `dsh plugin add` installs the local package, `--dump-config` shows `# == dsh-hello-plugin`, and `--dump-config-schema` exits 0.

## no-bundle-plugin (negative)

Has `package.json` + `index.js` but **no** `dsh.bundle`. Install still succeeds with a warning; hang-layer never appears (dump only shows base).

```
fixtures/no-bundle-plugin/
  package.json   # name: dsh-no-bundle — no dsh.bundle
  index.js
```

```bash
npx tsx src/cli.ts probe fixtures/no-bundle-plugin  # expect exit ≠0, hang false
```

## bad-patch-plugin (negative)

Declares `dsh.bundle.patch` pointing at invalid YAML (`{{{{ not yaml`). `dsh plugin add` rejects installation.

```
fixtures/bad-patch-plugin/
  package.json       # name: dsh-bad-patch, dsh.bundle.patch → ./cordis.patch.yml
  cordis.patch.yml   # invalid YAML
  index.js
```

```bash
npx tsx src/cli.ts probe fixtures/bad-patch-plugin  # expect exit ≠0, install false
```
