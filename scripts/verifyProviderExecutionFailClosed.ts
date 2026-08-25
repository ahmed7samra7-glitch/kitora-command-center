import { GeminiDriver, OpenAIDriver, ClaudeDriver } from '../server/orchestrationEngine.js';

const savedKeys: Record<string, string | undefined> = {};
for (const key of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'ANTHROPIC_API_KEY']) {
  savedKeys[key] = process.env[key];
  delete process.env[key];
}

const task: any = {
  taskId: 'ADVERSARIAL-PROVIDER-FAIL-CLOSED',
  payload: { prompt: 'adversarial fail-closed verification' }
};

const assertNotCompleted = (name: string, response: any) => {
  if (response.status === 'COMPLETED') {
    throw new Error(`${name}: provider execution returned COMPLETED without a live provider/evidence.`);
  }
};

try {
  assertNotCompleted('Gemini missing key', await new GeminiDriver().dispatch(task, {}));
  assertNotCompleted('OpenAI missing key', await new OpenAIDriver().dispatch(task, {}));
  assertNotCompleted('Claude missing key', await new ClaudeDriver().dispatch(task, {}));

  for (const [name, driver] of [['Gemini', new GeminiDriver()], ['OpenAI', new OpenAIDriver()], ['Claude', new ClaudeDriver()] ] as const) {
    const polled = await driver.poll(`${name}-UNVERIFIED-JOB`);
    if (polled.status === 'COMPLETED') throw new Error(`${name} poll fabricated completion.`);
    const callback = await driver.callback(`${name}-UNVERIFIED-JOB`, { status: 'COMPLETED', success: true });
    if (callback.status === 'COMPLETED') throw new Error(`${name} callback accepted fabricated completion.`);
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('ADVERSARIAL_NETWORK_FAILURE');
  }) as typeof fetch;

  process.env.GEMINI_API_KEY = 'test-key';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.CLAUDE_API_KEY = 'test-key';
  process.env.ANTHROPIC_API_KEY = 'test-key';

  assertNotCompleted('Gemini network exception', await new GeminiDriver().dispatch(task, {}));
  assertNotCompleted('OpenAI network exception', await new OpenAIDriver().dispatch(task, {}));
  assertNotCompleted('Claude network exception', await new ClaudeDriver().dispatch(task, {}));

  globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'HTTP 503' }), { status: 503 })) as typeof fetch;
  assertNotCompleted('Gemini HTTP 503', await new GeminiDriver().dispatch(task, {}));
  assertNotCompleted('OpenAI HTTP 503', await new OpenAIDriver().dispatch(task, {}));
  assertNotCompleted('Claude HTTP 503', await new ClaudeDriver().dispatch(task, {}));

  globalThis.fetch = originalFetch;
  console.log('Provider execution fail-closed verification: PASS');
} finally {
  for (const [key, value] of Object.entries(savedKeys)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
