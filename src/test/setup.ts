if (typeof globalThis !== 'undefined') {
  const g = globalThis as Record<string, any>;

  // In-memory mock storage store
  const mockStorageStore: Record<string, any> = {};

  if (!g.chrome) {
    g.chrome = {};
  }

  // Ensure runtime mock
  if (!g.chrome.runtime) {
    g.chrome.runtime = {};
  }
  g.chrome.runtime.id = 'web-to-figma-mock-id';
  g.chrome.runtime.sendMessage = (msg: any, callback?: any) => {
    if (typeof callback === 'function') callback({});
    return Promise.resolve({});
  };
  g.chrome.runtime.onMessage = { addListener: () => {} };
  g.chrome.runtime.onInstalled = { addListener: () => {} };
  g.chrome.runtime.onConnect = { addListener: () => {} };
  g.chrome.runtime.connect = () => ({
    name: 'MOCK_PORT',
    postMessage: () => {},
    onMessage: { addListener: () => {}, removeListener: () => {} },
    onDisconnect: { addListener: () => {}, removeListener: () => {} },
    disconnect: () => {}
  });

  // Ensure storage mock
  if (!g.chrome.storage) {
    g.chrome.storage = {};
  }
  const storageChangeListeners: Array<(changes: Record<string, any>, areaName: string) => void> = [];
  g.chrome.storage.onChanged = {
    addListener: (cb: (changes: Record<string, any>, areaName: string) => void) => {
      storageChangeListeners.push(cb);
    },
    removeListener: (cb: (changes: Record<string, any>, areaName: string) => void) => {
      const idx = storageChangeListeners.indexOf(cb);
      if (idx !== -1) storageChangeListeners.splice(idx, 1);
    }
  };
  g.__triggerStorageChange = (changes: Record<string, any>, areaName = 'local') => {
    for (const cb of storageChangeListeners) {
      cb(changes, areaName);
    }
  };

  g.chrome.storage.local = {
    get: (keys: string | string[] | Record<string, any> | null, callback?: any) => {
      let result: Record<string, any> = {};
      if (typeof keys === 'string') {
        result = { [keys]: mockStorageStore[keys] };
      } else if (Array.isArray(keys)) {
        for (const k of keys) {
          result[k] = mockStorageStore[k];
        }
      } else {
        result = { ...mockStorageStore };
      }
      if (typeof callback === 'function') callback(result);
      return Promise.resolve(result);
    },
    set: (items: Record<string, any>, callback?: any) => {
      const changes: Record<string, any> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: mockStorageStore[k], newValue: v };
      }
      Object.assign(mockStorageStore, items);
      for (const cb of storageChangeListeners) {
        cb(changes, 'local');
      }
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    },
    remove: (keys: string | string[], callback?: any) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, any> = {};
      for (const k of arr) {
        changes[k] = { oldValue: mockStorageStore[k], newValue: undefined };
        delete mockStorageStore[k];
      }
      for (const cb of storageChangeListeners) {
        cb(changes, 'local');
      }
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    },
    clear: (callback?: any) => {
      const changes: Record<string, any> = {};
      for (const k of Object.keys(mockStorageStore)) {
        changes[k] = { oldValue: mockStorageStore[k], newValue: undefined };
        delete mockStorageStore[k];
      }
      for (const cb of storageChangeListeners) {
        cb(changes, 'local');
      }
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    }
  };

  // Ensure tabs mock
  if (!g.chrome.tabs) {
    g.chrome.tabs = {};
  }
  let currentTabs = [
    {
      id: 101,
      url: 'https://example.com/test',
      title: 'Example Domain',
      active: true,
      currentWindow: true
    }
  ];
  g.chrome.tabs.query = (queryInfo: any, callback?: any) => {
    const res = currentTabs.filter((t) => {
      if (queryInfo.active && !t.active) return false;
      if (queryInfo.currentWindow && !t.currentWindow) return false;
      return true;
    });
    if (typeof callback === 'function') callback(res);
    return Promise.resolve(res);
  };
  g.chrome.tabs.get = (tabId: number, callback?: any) => {
    const tab = currentTabs.find((t) => t.id === tabId);
    if (!tab) {
      const err = new Error(`Tab ${tabId} not found`);
      return Promise.reject(err);
    }
    if (typeof callback === 'function') callback(tab);
    return Promise.resolve(tab);
  };
  g.__setMockTabs = (tabs: any[]) => {
    currentTabs = tabs;
  };

  // Ensure scripting mock
  if (!g.chrome.scripting) {
    g.chrome.scripting = {};
  }
  g.chrome.scripting.executeScript = (args: any, callback?: any) => {
    const res = [{ result: true }];
    if (typeof callback === 'function') callback(res);
    return Promise.resolve(res);
  };

  // Ensure permissions mock
  if (!g.chrome.permissions) {
    g.chrome.permissions = {};
  }
  const grantedOrigins = new Set<string>();
  g.chrome.permissions.contains = (perm: { origins?: string[] }, callback?: (res: boolean) => void) => {
    const res = !perm.origins ? true : perm.origins.every((o) => grantedOrigins.has(o));
    if (typeof callback === 'function') callback(res);
    return Promise.resolve(res);
  };
  g.chrome.permissions.request = (perm: { origins?: string[] }, callback?: (res: boolean) => void) => {
    if (perm.origins) {
      for (const o of perm.origins) {
        grantedOrigins.add(o);
      }
    }
    if (typeof callback === 'function') callback(true);
    return Promise.resolve(true);
  };
  g.chrome.permissions.remove = (perm: { origins?: string[] }, callback?: (res: boolean) => void) => {
    if (perm.origins) {
      for (const o of perm.origins) {
        grantedOrigins.delete(o);
      }
    }
    if (typeof callback === 'function') callback(true);
    return Promise.resolve(true);
  };
  g.chrome.permissions.getAll = (callback?: (res: { origins: string[] }) => void) => {
    const res = { origins: Array.from(grantedOrigins) };
    if (typeof callback === 'function') callback(res);
    return Promise.resolve(res);
  };

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
