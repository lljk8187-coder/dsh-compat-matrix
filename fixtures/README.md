# fixtures/

Sample plugins and expected snippets for local probes.

## hello-plugin

Minimal official-shape dsh plugin used by M2 `probe`:

```
fixtures/hello-plugin/
  package.json      # name: dsh-hello-plugin, dsh.bundle.patch → ./cordis.patch.yml
  cordis.patch.yml  # inserts hang-layer id `hello` / name `dsh-hello-plugin`
  index.js          # export name + apply()
```

Probe with a temporary `DSH_HOME` (never writes to `~/.dsh`):

```bash
export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH"  # or your node22 + dsh paths
npx tsx src/cli.ts probe fixtures/hello-plugin
```

Success means `dsh plugin add` installs the local package and `--dump-config` shows a hang-layer line like `# == dsh-hello-plugin`. That dump is **not** a full boot.
