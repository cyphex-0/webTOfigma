if (typeof globalThis !== 'undefined') {
  const g = globalThis as Record<string, any>;
  if (!g.chrome) {
    g.chrome = {
      runtime: {
        id: 'web-to-figma-mock-id',
        sendMessage: () => Promise.resolve({}),
        onMessage: {
          addListener: () => {},
        },
        onInstalled: {
          addListener: () => {},
        },
      },
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
      },
    };
  }
}
