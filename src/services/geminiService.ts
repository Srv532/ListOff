import { ListItem, Tone } from "../types";

export type ProgressCallback = (progress: number, stage: string) => void;

export async function generateList(
  topic: string,
  tone: Tone,
  onProgress?: ProgressCallback,
  skipCache: boolean = false
): Promise<ListItem[]> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ topic, tone });
    if (skipCache) params.append('refresh', 'true');
    const url = `/api/generate-stream?${params.toString()}`;
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Request timed out after 90 seconds. Please try a shorter topic.'));
      }
    }, 90000);

    // Use fetch with ReadableStream to handle SSE
    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          clearTimeout(timeoutId);
          const body = await response.json().catch(() => ({}));
          reject(new Error((body as { error?: string }).error || `Server error (${response.status})`));
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) {
          clearTimeout(timeoutId);
          reject(new Error('No response stream available.'));
          return;
        }

        const processChunk = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? ''; // keep incomplete line in buffer

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                try {
                  const event = JSON.parse(jsonStr) as {
                    type: 'progress' | 'result' | 'error';
                    progress?: number;
                    stage?: string;
                    items?: ListItem[];
                    modelUsed?: string;
                    cached?: boolean;
                    message?: string;
                  };

                  if (event.type === 'progress' && onProgress && event.progress !== undefined) {
                    onProgress(event.progress, event.stage ?? '');
                  } else if (event.type === 'result') {
                    if (!settled) {
                      settled = true;
                      clearTimeout(timeoutId);
                      if (!event.items || event.items.length === 0) {
                        reject(new Error('No results returned. Please try again.'));
                      } else {
                        if (event.modelUsed) console.info(`✅ Model: ${event.modelUsed}${event.cached ? ' (cached)' : ''}`);
                        resolve(event.items);
                      }
                    }
                  } else if (event.type === 'error') {
                    if (!settled) {
                      settled = true;
                      clearTimeout(timeoutId);
                      reject(new Error(event.message ?? 'Unknown server error.'));
                    }
                  }
                } catch { /* ignore malformed SSE line */ }
              }
            }
          } catch (streamErr) {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              reject(new Error('Stream connection lost. Please try again.'));
            }
          }
        };

        processChunk();
      })
      .catch((fetchErr: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(new Error(fetchErr instanceof Error ? fetchErr.message : 'Network error. Is the server running?'));
        }
      });
  });
}
