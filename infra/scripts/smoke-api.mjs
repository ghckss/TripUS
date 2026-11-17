const endpoint = process.argv.slice(2).find((argument) => argument !== '--') ?? process.env.TRIPUS_API_URL;
if (!endpoint) throw new Error('Pass the API endpoint URL or set TRIPUS_API_URL');

const healthUrl = new globalThis.URL('/v1/health', endpoint);
const response = await globalThis.fetch(healthUrl, {
  headers: process.env.TRIPUS_API_ACCESS_TOKEN
    ? { authorization: `Bearer ${process.env.TRIPUS_API_ACCESS_TOKEN}` }
    : undefined,
  signal: globalThis.AbortSignal.timeout(15_000),
});
const body = await response.text();
if (!response.ok) {
  throw new Error(`Smoke test failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
}
const parsed = JSON.parse(body);
if (parsed?.status !== 'ok') throw new Error(`Unexpected health response: ${body.slice(0, 500)}`);

console.log(`Smoke test passed: ${healthUrl.toString()}`);
