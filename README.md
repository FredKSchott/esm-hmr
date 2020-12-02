# ESM Hot Module Replacement (ESM-HMR) Spec

**\_Author:** [Fred K. Schott](https://github.com/FredKSchott) (Snowpack), [Jovi De Croock](https://github.com/JoviDeCroock) (Preact), [Evan You](https://github.com/yyx990803) (Vue)\_  
**\_Status:** In Progress\_

Hot Module Replacement (HMR) lets your browser live-update individual JavaScript modules in your application during development _without triggering a full browser reload or losing the current web application state._ This speeds up your development speed with faster updates on every change.

Web bundlers like Webpack, Rollup, and Parcel all implemented different, bundler-specific HMR interfaces. This makes it hard to share HMR integrations across dev environments. As a result, many framework integrations like React Fast Refresh and Preact's Prefresh need to be rewritten for every bundler that they'd like to support. See:

- https://github.com/facebook/react/issues/16604#issuecomment-528663101
- https://github.com/JoviDeCroock/prefresh

**ESM-HMR is a standard HMR API for ESM-based dev environments.** The rise of bundle-free development creates the opportunity for a common, standard HMR API built on top of the browser's native module system. ESM-HMR is built for the browser's native module system, so it can be used in any ESM-based dev environment.

## Who's Using ESM-HMR?

- [Snowpack](http://snowpack.dev/)

## What's in This Repo?

1. `esm-hmr/client.js` - A client-side ESM-HMR runtime.
1. `esm-hmr/server.js` - A server-side ESM-HMR engine to manage connected clients.
1. An ESM-HMR spec to help your write your own client/server pieces. (coming soon)

## Usage Example

```js
export let foo = 1;

if (import.meta.hot) {
  // Receive any updates from the dev server, and update accordingly.
  import.meta.hot.accept(({ module }) => {
    try {
      foo = module.foo;
    } catch (err) {
      // If you have trouble accepting an update, mark it as invalid (reload the page).
      import.meta.hot.invalidate();
    }
  });
  // Optionally, clean up any side-effects in the module before loading a new copy.
  import.meta.hot.dispose(() => {
    /* ... */
  });
}
```

## ESM-HMR API Overview

All ESM-HMR implementations will follow this API the behavior outlined below. If you have any questions (or would like clarity on some undefined behavior) file an issue and we'll take a look!

### `import.meta.hot`

```js
if (import.meta.hot) {
  // Your HMR code here...
}
```

- If HMR is enabled, `import.meta.hot` will be defined.
- If HMR is disabled (ex: you are building for production), `import.meta.hot` should be undefined.
- You can expect your production build to strip out `if (import.meta.hot) { ... }` as dead code.
- **Important:** You must use the fully expanded `import.meta.hot` statement somewhere in the file so that the server can statically check and enable HMR usage.

Note: [`import.meta`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import.meta) is the new location for module metadata in ES Modules.

### `import.meta.hot.accept`

#### `accept()`

```js
import.meta.hot.accept();
```

- Accept HMR updates for this module.
- When this module is updated, it will be automatically re-imported by the browser.
- **Important:** Re-importing an updated module instance doesn't automatically replace the current module instance in your application. If you need to update your current module's exports, you'll need a callback handler.

**USE CASE:** Your module has no exports, and runs just by being imported (ex: adds a `<style>` element to the page).

#### `accept(handler: ({module: any}) => void)`

```js
export let foo = 1;
import.meta.hot.accept(
  ({
    module, // An imported instance of the new module
  }) => {
    foo = module.foo;
  }
);
```

- Accept HMR updates for this module.
- Runs the accept handler with the updated module instance.
- Use this to apply the new module exports to the current application's module instance. This is what accepts your update into the the running application.

**This is an important distinction!** ESM-HMR never replaces the accepting module for you. Instead, the current module is given an instance of the updated module in the `accept()` callback. It's up to the `accept()` callback to apply that update to the current module in the current application.

**USE CASE:** Your module has exports that need to be updated.

#### `accept(deps: string[], handler: ({deps: any[]; module: any;}) => void)`

```js
import moduleA from "./modules/a.js";
import moduleB from "./modules/b.js";

export let store = createStore({ a: moduleA, b: moduleB });

import.meta.hot.accept(
  ["./modules/a.js", "./modules/b.js"],
  ({ module, deps }) => {
    // Get the new
    store.replaceModules({
      a: deps[0].default,
      b: deps[1].default,
    });
  }
);
```

Sometimes, it's not possible to update an existing module without a reference to its dependencies. If you pass an array of dependency import specifiers to your accept handler, those modules will be available to the callback via the `deps` property. Otherwise, the `deps` property will be empty.

**USE CASE:** You need a way to reference your dependencies to update the current module.

### `dispose(callback: () => void)`

```js
document.head.appendChild(styleEl);
import.meta.hot.dispose(() => {
  document.head.removeChild(styleEl);
});
```

The `dispose()` callback executes before a new module is loaded and before `accept()` is called. Use this to remove any side-effects and perform any cleanup before loading a second (or third, or forth, or...) copy of your module.

**USE CASE:** Your module has side-effects that need to be cleaned up.

### `decline()`

```js
import.meta.hot.decline();
```

- This module is not HMR-compatible.
- Decline any updates, forcing a full page reload.

**USE CASE:** Your module cannot accept HMR updates, for example due to permenant side-effects.

### `invalidate()`

```js
import.meta.hot.accept(({ module }) => {
  if (!module.foo) {
    import.meta.hot.invalidate();
  }
});
```

- Conditionally invalidate the current module when called.
- This will reject an in-progress update and force a page reload.

**USE CASE:** Conditionally reject an update if some condition is met.

### `import.meta.hot.data`

```js
export let foo = 1;

if (import.meta.hot) {
  // Recieve data from the dispose() handler
  import.meta.hot.accept(({ module }) => {
    foo = import.meta.hot.data.foo || module.foo;
  });
  // Pass data to the next accept handler call
  import.meta.hot.dispose(() => {
    import.meta.hot.data = { foo };
  });
}
```

- You can use `import.meta.hot.data` to pass data from the `dispose()` handler(s) to the `accept()` handler(s).
- Defaults to an empty object (`{}`) every time an update starts.

## ESM-HMR Behavior Overview

_Note: This spec is still in progress, and is more of a rough overview at this point._

### Terminology

- "HMR Server Engine" - The server component of HMR. Responsible for tracking changes and sending updates to the client runtime.
- "HMR Client Runtime" - The client/browser component of HMR. Responsible for receiving updates from the server engine and updating the client appropriately.
- "HMR-Enabled File" - Any file that includes a reference to `import.meta.hot` is considered HMR-Enabled.

### Update Events

When a file is changed, 1 or more events are sent to the browser. What these events look like (and how they are is handled) depends on your application:

- If the changed file is HMR-Enabled, the server will send an update for that one file.
- Otherwise, the server will "bubble" the update event up to check each parent of that file.
- Event bubbling is repeated until every event is handled, or an event has reached
- If an event bubbles all the way up without finding an HMR-enabled parent, the event is considered "unhandled" and a full page reload is triggered.

## Prior Art

This spec wouldn't exist without the prior work of the following projects:

- @rixo's [rollup-plugin-hot](https://github.com/rixo/rollup-plugin-hot)
- [Webpack HMR](https://webpack.js.org/concepts/hot-module-replacement/)
- [Parcel HMR](https://parceljs.org/hmr.html)
