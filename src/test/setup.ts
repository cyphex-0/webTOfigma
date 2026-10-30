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

  // Mock standard ClipboardItem if not available in Node/jsdom test runtime
  if (typeof g.ClipboardItem === 'undefined') {
    class MockClipboardItem {
      readonly types: readonly string[];
      private readonly items: Record<string, Blob>;

      constructor(items: Record<string, Blob>) {
        this.items = items;
        this.types = Object.freeze(Object.keys(items));
      }

      getType(type: string): Promise<Blob> {
        const item = this.items[type];
        if (!item) {
          return Promise.reject(new Error(`DOMException: Failed to execute 'getType' on 'ClipboardItem'`));
        }
        return Promise.resolve(item);
      }
    }
    g.ClipboardItem = MockClipboardItem;
  }
}
