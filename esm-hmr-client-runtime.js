/**
 * esm-hmr-client-runtime.ts
 *
 * A client-side implementation of the ESM-HMR spec, for reference.
 */

function debug(...args) {
  console.log('[ESM-HMR]', ...args);
}

const REGISTERED_MODULES = {};

class HotModuleState {
  id: string;
  isLocked: boolean = false;
  acceptCallback?: true | (({module: any}) => void);
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

  accept(callback: true | (({module}) => void) = true): void {
    if (!this.isLocked) {
      this.acceptCallback = callback;
    }
    this.isLocked = true;
  }
}

export function createHotContext(fullUrl) {
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

async function applyUpdate(id) {
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
const reload = () => location.reload(true);
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

  const id = new URL(data.url).pathname;
  debug(id, Object.keys(REGISTERED_MODULES));
  applyUpdate(id)
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
