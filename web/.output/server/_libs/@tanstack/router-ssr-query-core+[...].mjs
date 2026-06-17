import { d as dehydrate } from "../tanstack__query-core.mjs";
function setupCoreRouterSsrQueryIntegration({ router, queryClient, dehydrateOptions, hydrateOptions, handleRedirects = true }) {
  router.options.hydrate;
  const ogDehydrate = router.options.dehydrate;
  {
    const sentQueries = /* @__PURE__ */ new Set();
    const queryStream = createPushableStream();
    let unsubscribe = void 0;
    let cleanupRegistered = false;
    let tornDown = false;
    const teardown = () => {
      if (tornDown) return;
      tornDown = true;
      try {
        unsubscribe?.();
      } catch {
      }
      unsubscribe = void 0;
      try {
        if (!queryStream.isClosed()) queryStream.close();
      } catch {
      }
      try {
        queryClient.cancelQueries();
      } catch {
      }
      try {
        queryClient.clear();
      } catch {
      }
      sentQueries.clear();
    };
    const registerCleanup = (serverSsr = router.serverSsr) => {
      if (cleanupRegistered) return;
      if (!serverSsr) return;
      serverSsr.onCleanup(teardown);
      cleanupRegistered = true;
    };
    router.serverSsrLifecycle = {
      ...router.serverSsrLifecycle,
      onServerSsrAttach: [...router.serverSsrLifecycle?.onServerSsrAttach ?? [], registerCleanup]
    };
    router.options.dehydrate = async () => {
      router.serverSsr.onRenderFinished(() => {
        if (!queryStream.isClosed()) queryStream.close();
        unsubscribe?.();
        unsubscribe = void 0;
      });
      const dehydratedRouter = {
        ...await ogDehydrate?.(),
        queryStream: queryStream.stream
      };
      const dehydratedQueryClient = dehydrate(queryClient, dehydrateOptions);
      if (dehydratedQueryClient.queries.length > 0) {
        dehydratedQueryClient.queries.forEach((query) => {
          sentQueries.add(query.queryHash);
        });
        dehydratedRouter.dehydratedQueryClient = dehydratedQueryClient;
      }
      return dehydratedRouter;
    };
    const ogClientOptions = queryClient.getDefaultOptions();
    queryClient.setDefaultOptions({
      ...ogClientOptions,
      dehydrate: {
        shouldDehydrateQuery: () => true,
        ...ogClientOptions.dehydrate
      }
    });
    unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!router.serverSsr?.isDehydrated()) return;
      if (sentQueries.has(event.query.queryHash)) return;
      if (!event.query.promise) return;
      if (queryStream.isClosed()) {
        console.warn(`tried to stream query ${event.query.queryHash} after stream was already closed`);
        return;
      }
      const dehydratedQuery = dehydrate(queryClient, {
        ...dehydrateOptions,
        shouldDehydrateQuery: (query) => {
          if (query.queryHash !== event.query.queryHash) return false;
          return (ogClientOptions.dehydrate?.shouldDehydrateQuery?.(query) ?? true) && (dehydrateOptions?.shouldDehydrateQuery?.(query) ?? true);
        }
      });
      if (dehydratedQuery.queries.length === 0) return;
      sentQueries.add(event.query.queryHash);
      queryStream.enqueue(dehydratedQuery);
    });
  }
}
function createPushableStream() {
  let controllerRef;
  const stream = new ReadableStream({ start(controller) {
    controllerRef = controller;
  } });
  let _isClosed = false;
  return {
    stream,
    enqueue: (chunk) => {
      if (!_isClosed) controllerRef.enqueue(chunk);
    },
    close: () => {
      if (_isClosed) return;
      controllerRef.close();
      _isClosed = true;
    },
    isClosed: () => _isClosed,
    error: (err) => {
      if (_isClosed) return;
      _isClosed = true;
      controllerRef.error(err);
    }
  };
}
export {
  setupCoreRouterSsrQueryIntegration as s
};
