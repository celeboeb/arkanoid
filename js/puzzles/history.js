export function createHistory(limit = 80) {
  const stack = [];
  return {
    get canUndo() {
      return stack.length > 0;
    },
    checkpoint(state) {
      stack.push(state);
      if (stack.length > limit) stack.shift();
    },
    undo() {
      return stack.length ? stack.pop() : null;
    },
    clear() {
      stack.length = 0;
    },
    dump() {
      return stack.slice();
    },
    load(items) {
      stack.length = 0;
      if (Array.isArray(items)) {
        for (const item of items.slice(-limit)) stack.push(item);
      }
    },
  };
}
