/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

export type DurableMcpClientConfig = {
  base_url?: string;
  api_key?: string;
  fetcher?: typeof fetch;
};

export class DurableMcpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetcher: typeof fetch;

  constructor(config: DurableMcpClientConfig = {}) {
    this.baseUrl = (
      config.base_url ||
      process.env.OPENMEMORY_URL ||
      "http://localhost:8080"
    ).replace(/\/$/, "");
    this.apiKey =
      config.api_key ||
      process.env.OPENMEMORY_API_KEY ||
      process.env.OM_API_KEY;
    this.fetcher = config.fetcher || fetch;
  }

  private async request(path: string, options: RequestInit = {}) {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(
        `OpenMemory HTTP ${response.status}: ${text || response.statusText}`,
      );
    }
    return body;
  }

  store(input: Record<string, unknown>) {
    return this.request("/memories", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  search(input: Record<string, unknown>) {
    return this.request("/recall", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  get(input: { id: string; user_id?: string; project_id?: string }) {
    const query = new URLSearchParams();
    if (input.user_id) query.set("user_id", input.user_id);
    if (input.project_id) query.set("project_id", input.project_id);
    return this.request(
      `/memories/${encodeURIComponent(input.id)}${query.size ? `?${query}` : ""}`,
    );
  }

  list(input: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return this.request(`/memories${query.size ? `?${query}` : ""}`);
  }

  update(input: Record<string, unknown> & { id: string }) {
    const { id, ...body } = input;
    return this.request(`/memories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  delete(input: {
    id: string;
    user_id?: string;
    actor_id?: string;
    reason?: string;
  }) {
    const query = new URLSearchParams();
    if (input.user_id) query.set("user_id", input.user_id);
    return this.request(
      `/memories/${encodeURIComponent(input.id)}${query.size ? `?${query}` : ""}`,
      {
        method: "DELETE",
        body: JSON.stringify({
          actor_id: input.actor_id,
          reason: input.reason,
        }),
      },
    );
  }

  explain(input: { id: string; recall_query?: string; recall_mode?: string }) {
    const query = new URLSearchParams();
    if (input.recall_query) query.set("recall_query", input.recall_query);
    if (input.recall_mode) query.set("recall_mode", input.recall_mode);
    return this.request(
      `/memories/${encodeURIComponent(input.id)}/explain${query.size ? `?${query}` : ""}`,
    );
  }

  ingest(input: Record<string, unknown>) {
    return this.request("/ingest", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
