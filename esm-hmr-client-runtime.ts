/**
 * esm-hmr-client-runtime.ts
 *
 * A client-side implementation of the ESM-HMR spec, for reference.
 */

function debug(...args: any[]) {
  console.log('[ESM-HMR]', ...args);
}
function reload() {
  location.reload(true);
}

const REGISTERED_MODULES: {[key: string]: HotModuleState} = {};

class HotModuleState {
  id: string;
  isLocked: boolean = false;
  acceptCallback?: true | ((args: {module: any}) => void);
  disposeCallbacks: (() => void)[] = [];

  constructor(id: string) {
    this.id = id;
  }

  lock(): void {
    this.isLocked = true;
  }

  dispose(callback: () => void): void {
    this.disposeCallbacks.push(callback);
  }

  accept(callback: true | ((args: {module: any}) => void) = true): void {
    if (!this.isLocked) {
      this.acceptCallback = callback;
    }
    this.isLocked = true;
  }
  invalidate(): void {
    reload();
  }
}

export function createHotContext(fullUrl: string) {
  const id = new URL(fullUrl).pathname;
  const existing = REGISTERED_MODULES[id];
  if (existing) {
    existing.lock();
    return existing;
  }
  const state = new HotModuleState(id);
  REGISTERED_MODULES[id] = state;
  return state;
}

async function applyUpdate(id: string) {
  const state = REGISTERED_MODULES[id];
  if (!state || !id.endsWith('.js')) {
    return false;
  }

  const acceptCallback = state.acceptCallback;
  const disposeCallbacks = state.disposeCallbacks;
  state.disposeCallbacks = [];

  if (acceptCallback) {
    const module = await import(id + `?mtime=${Date.now()}`);
    if (acceptCallback === true) {
      // Do nothing, importing the module side-effects was enough.
    } else {
      await acceptCallback({module});
    }
  }
  await Promise.all(disposeCallbacks.map((cb) => cb()));
  return true;
}

const source = new EventSource('/livereload');
source.onerror = () => (source.onopen = reload);
source.onmessage = async (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'reload') {
    debug('message: reload');
    reload();
    return;
  }
  if (data.type !== 'update') {
    debug('message: unknown', data);
    return;
  }
  debug('message: update', data);
  debug(data.url, Object.keys(REGISTERED_MODULES));
  applyUpdate(data.url)
    .then((ok) => {
      if (!ok) {
        reload();
      }
    })
    .catch((err) => {
      console.error(err);
      reload();
    });
};

debug('listening for file changes...');
