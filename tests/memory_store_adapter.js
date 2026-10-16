/* TEST ONLY. NOT LOADED BY src/index.html OR INCLUDED IN dist.
 * Opaque about:blank cannot use IndexedDB. This minimal asynchronous in-memory
 * adapter exercises UI logic; it is NOT an IndexedDB persistence test.
 */
(() => {
  const stores = new Map(['records', 'sessions', 'chunks'].map(n => [n, new Map()]));
  const db = {
    transaction(names, mode) {
      const allowed = new Set(Array.isArray(names) ? names : [names]);
      const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
      let pending = 0;
      let timer;
      const queueComplete = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (pending === 0) tx.oncomplete?.({target: tx}); }, 0);
      };
      const request = (fn) => {
        pending += 1;
        const req = {result: undefined, error: null, onsuccess: null, onerror: null};
        setTimeout(() => {
          try {
            req.result = structuredClone(fn());
            req.onsuccess?.({target: req});
          } catch (error) {
            req.error = tx.error = error;
            req.onerror?.({target: req});
            tx.onerror?.({target: tx});
          } finally { pending -= 1; queueComplete(); }
        }, 0);
        return req;
      };
      tx.objectStore = (name) => {
        if (!allowed.has(name)) throw new Error('Unknown test object store: ' + name);
        const data = stores.get(name);
        return {
          put(item) { return request(() => { data.set(item.id, structuredClone(item)); return item.id; }); },
          delete(id) { return request(() => data.delete(id)); },
          getAll() { return request(() => [...data.values()]); },
          index(key) { return { getAll(value) { return request(() => [...data.values()].filter(v => v[key] === value)); } }; }
        };
      };
      queueComplete();
      return tx;
    }
  };
  openDB = async () => db;
})();
