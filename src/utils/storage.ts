class SafeStorage {
  private memoryStorage: Record<string, string> = {};

  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`SafeStorage: Access to localStorage is denied for key "${key}". Falling back to in-memory store.`, e);
    }
    return this.memoryStorage[key] !== undefined ? this.memoryStorage[key] : null;
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`SafeStorage: Write to localStorage is denied for key "${key}". Falling back to in-memory store.`, e);
    }
    this.memoryStorage[key] = value;
  }

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`SafeStorage: Removal from localStorage is denied for key "${key}". Falling back to in-memory store.`, e);
    }
    delete this.memoryStorage[key];
  }
}

export const safeStorage = new SafeStorage();

export function ordersStorageKey(uid?: string | null): string {
  return uid ? `digivisa_orders_${uid}` : 'digivisa_orders_guest';
}

export function safeOpen(url: string, target = '_blank'): Window | null {
  try {
    if (typeof window !== 'undefined') {
      const win = window.open(url, target);
      if (!win) {
        console.warn(`safeOpen: window.open returned null or was blocked for URL "${url}".`);
      }
      return win;
    }
  } catch (e) {
    console.warn(`safeOpen: Failed to open URL "${url}" due to browser/iframe restrictions:`, e);
  }
  return null;
}
