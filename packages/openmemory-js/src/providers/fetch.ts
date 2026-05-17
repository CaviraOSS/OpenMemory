const DEFAULT_PROVIDER_TIMEOUT_MS = 30000;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const providerTimeoutMs = () => {
  const value = Number(process.env.OM_PROVIDER_TIMEOUT_MS);
  return Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_PROVIDER_TIMEOUT_MS;
};

const providerRetries = () => {
  const value = Number(process.env.OM_PROVIDER_RETRIES);
  return Number.isInteger(value) && value >= 0 ? value : 1;
};

const retryDelayMs = () => {
  const value = Number(process.env.OM_PROVIDER_RETRY_DELAY_MS);
  return Number.isInteger(value) && value >= 0 ? value : 100;
};

const isSafeRead = (method?: string) => {
  const normalized = (method || "GET").toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
};

const sleep = (ms: number) =>
  ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();

export async function fetchWithProviderTimeout(
  url: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs());
  const callerSignal = init.signal;

  const abort = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abort, { once: true });

  try {
    const attempts = isSafeRead(init.method) ? providerRetries() + 1 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
        if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts) {
          return response;
        }
      } catch (error) {
        if (controller.signal.aborted || attempt === attempts) throw error;
        lastError = error;
      }

      await sleep(retryDelayMs() * attempt);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("provider fetch failed");
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abort);
  }
}
