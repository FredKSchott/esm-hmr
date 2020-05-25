# ESM Hot Module Replacement (ESM-HMR) Spec

_Author: Fred K. Schott (co-authors welcome!)_  
_Status: In Progress_

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
  // accept(): Receive any updates from the dev server, and update accordingly.
  import.meta.hot.accept(({ module }) => {
    try {
      foo = module.foo;
    } catch (err) {
      // invalidate(): Mark the update as not valid, usually forcing a page refresh.
      import.meta.hot.invalidate();
    }
  });
  // dispose(): Optional side-effect cleanup logic to run before an update is applied.
  import.meta.hot.dispose(() => {
    /* ... */
  });
}
```

## ESM-HMR API Overview

### `import.meta.hot`

```js
if (import.meta.hot) {
  // Your HMR code here...
}
```

- All HMR logic is scoped to the [`import.meta`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import.meta) `hot` property.
- This object should exist in any ESM-HMR environment, and be falsey or undefined otherwise (in production).
- You should expect your production build to strip out `if (import.meta.hot) { ... }` as dead code.
- **Important:** For performance reasons, you must use the fully expanded `if (import.meta.hot)` statement. Some ESM-HMR servers may check for this string without parsing each file into a full AST.

### `accept()`

```js
import.meta.hot.accept();
```

- Accept HMR updates for this module.
- This module will be automatically reloaded and rerun on every update. BUT, without an accept handler to apply those updates, your module exports may not be updated to the latest code.

**USE CASE:** Your module has no exports, and runs just by being imported.

### `accept(callback: ({module: any; data: any}) => void)`

```js
export let foo = 1;
import.meta.hot.accept(
  ({
    module, // An imported instance of the new module
    data, // Data passed from the dispose callback (optional)
  }) => {
    foo = module.foo;
  }
);
```

Accept HMR updates for this file, and apply them to the current module. Whenever an update is received, the browser will `import()` a new copy of the module and pass it to the `accept()` callback. It's up to this callback to apply those updates to the current module. This act is what accepts your update into the the running application.

**This is an important distinction!** ESM-HMR never replaces the accepting module for you. Instead, the current module is given an instance of the updated module in the `accept()` callback. It's up to the `accept()` callback to apply that update to the current module in the current application.

**USE CASE:** Your module has exports that need to be updated.

### `accept(deps: string[], callback: ({deps: []; module: any; data: any}) => void)`

```js
import moduleA from "./modules/a.js";
import moduleB from "./modules/b.js";

export const store = createStore({
  modules: { a: moduleA, b: moduleB },
});

import.meta.hot.accept(
  ["./modules/a.js", "./modules/b.js"],
  ({ module, deps }) => {
    store.replaceModules({
      a: deps[0].default,
      b: deps[1].default,
    });
  }
);
```

Sometimes, it's not possible to update an existing module without a reference to some dependency. If you pass an array of dependency import specifiers to your accept handler, those modules will be available to the callback via the `deps` property. Otherwise, the `deps` property will be empty.

**USE CASE:** You need a way to reference your dependencies to update the current module.

### `dispose(callback: ({data: any}) => void)`

```js
document.head.appendChild(styleEl);
import.meta.hot.dispose(({ data }) => {
  document.head.removeChild(styleEl);
});
```

The `dispose()` callback executes before a new module is loaded and before `accept()` is called. Use this to remove any side-effects and perform any cleanup before loading a second (or third, or forth, or...) copy of your module.

You can send some state info to the next `accept()` call by attaching it to the `data` argument. The `data` argument object lives on after the callback completes, and is passed directly as the `data` argument to the next `accept()` call.

**USE CASE:** Your module has side-effects that need to be cleaned up.

### `decline()`

```js
import.meta.hot.decline();
```

This module is not HMR-compatible. Decline any updates, forcing a full page reload.

**USE CASE:** Your module cannot accept HMR updates, for example due to permenant side-effects.

### `invalidate()`

```js
import.meta.hot.accept(({ module }) => {
  if (!module.foo) {
    import.meta.hot.invalidate();
  }
});
```

Invalidate the current module. Similar to the `decline()` function, this will reject the update and force a page reload.

**USE CASE:** Conditionally reject an update if some condition is met.

<!--
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
-->

## Prior Art

This spec wouldn't exist without the prior work of the following projects:

- @rixo's [rollup-plugin-hot](https://github.com/rixo/rollup-plugin-hot)
- [Webpack HMR](https://webpack.js.org/concepts/hot-module-replacement/)
- [Parcel HMR](https://parceljs.org/hmr.html)
