# ESM Hot Module Replacement (ESM-HMR) Spec

*Author: Fred K. Schott (co-authors welcome!)*  
*Status: In Progress*

Hot Module Replacement (HMR) lets your website live-update during development without triggering a full browser reload or losing the current web application state. This can considerably speed up your iteration speed during development, saving you valuable time.

Web bundlers like Webpack, Rollup, and Parcel have all implemented different, custom bundler-specific HMR interfaces. This makes it hard to share HMR integrations across dev environments. As a result, many integrations need to be rewritten for every bundler that they'd like to support. See: 
  - https://github.com/facebook/react/issues/16604#issuecomment-528663101
  - https://github.com/JoviDeCroock/prefresh

**ESM-HMR is a standard HMR API for ESM-based dev environments.** The rise of bundle-free development creates the opportunity for a common, standard HMR API built on top of the browser's native module system. ESM-HMR leverages the browser's native module system to create a common API for hot module replacement that can work in any ESM-based dev environment.

## Who's Using ESM-HMR?

- [Snowpack](http://snowpack.dev/)

## What's in This Repo?

1. The proposed ESM-HMR spec.
2. A reference implementation of that spec: [esm-hmr-client-runtime.ts](/esm-hmr-client-runtime.ts)

# The Spec

#### A Guided Example

```js
// Automatically injected into the response by the dev server:
import * as $HMR$ from '/esm-hmr-client-runtime.js';
import.meta.hot = $HMR$.createHotContext(import.meta.url);

// Your module's JavaScript code:
export let foo = 1;

// HMR Logic:
if (import.meta.hot) {
  // Required: Mark this module as HMR-ready.
  // - Receive any module updates into the accept callback.
  // - Update the main module acordingly.
  import.meta.hot.accept(({module}) => {
    try {
      foo = module.foo;
    } catch (err) {
      // Optional: If an error occurs during update, invalidate the module.
      // This will naively trigger a full page reload.
      import.meta.hot.invalidate();
    }
  });
  // Optional: Perform any cleanup when a module is replaced.
  import.meta.hot.dispose(() => { /* ... */ });
}
```

## Spec Details

Note: We are still fleshing this out, and this section is still under development. 

Our first goal is to generalize and document Snowpack's browser-native HMR implementation for a first-round of feedback. Our second goal is to expand this spec to support Preact's Prefresh, React's Fast Reload + Error Reporting, and any features needed by other popular HMR implementations. 


## Prior Art

This spec wouldn't exist without the prior work of the following projects:

- @rixo's [rollup-plugin-hot](https://github.com/rixo/rollup-plugin-hot)
- [Webpack HMR](https://webpack.js.org/concepts/hot-module-replacement/)
- [Parcel HMR](https://parceljs.org/hmr.html)
