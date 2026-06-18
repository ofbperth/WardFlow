export async function measureServerTiming<T>(
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  if (process.env.NODE_ENV === "production") {
    return work();
  }

  const startedAt = Date.now();

  try {
    return await work();
  } finally {
    const durationMs = Date.now() - startedAt;
    console.info(`[perf] ${label}: ${durationMs}ms`);
  }
}
