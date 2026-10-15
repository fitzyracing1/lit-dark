// Preload for tests: answers GitHub API calls from MOCK_RUNS (JSON array of workflow runs) or MOCK_STATUS.
globalThis.fetch = async () => {
  const status = Number(process.env.MOCK_STATUS || 200);
  const body = JSON.stringify({ workflow_runs: JSON.parse(process.env.MOCK_RUNS || '[]') });
  return new Response(status === 200 ? body : 'nope', { status, headers: { 'content-type': 'application/json' } });
};
