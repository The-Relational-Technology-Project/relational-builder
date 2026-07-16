// Bench harness entry: boots Vite in SSR middleware mode so bench/run.ts can
// import the app's real modules (providers, context builder, esbuild bundler,
// kit) — including their Vite-isms (`?raw`, `?url`, `import.meta.env.VITE_*`)
// that plain Node can't load. Zero extra dependencies: the same `vite` that
// serves the app executes the harness.
//
// Usage:  npm run bench -- [flags]        (see bench/run.ts or --help)

// Vars already present in process.env beat .env files, so setting these BEFORE
// createServer guarantees the harness talks to model APIs directly with env
// keys — never through the community proxy, never via the RTP-hosted tier.
process.env.VITE_LLM_PROXY_URL = '';
delete process.env.VITE_RTP_MODEL_URL;

const { createServer } = await import('vite');

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
  optimizeDeps: { noDiscovery: true },
});

let code = 1;
try {
  const { main } = await server.ssrLoadModule('/bench/run.ts');
  code = (await main(process.argv.slice(2))) ?? 0;
} catch (err) {
  console.error(err);
} finally {
  await server.close();
}
process.exit(code);
