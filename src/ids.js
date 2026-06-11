// Single string-id generator — never derived from DOM element ids.

let counter = 0;

export function nextId(prefix) {
  counter += 1;
  return prefix + counter;
}

// Bump the counter past any ids already in use (e.g. after restoring a
// persisted session) so new ids never collide with loaded ones.
export function seedIds(existingIds) {
  for (const id of existingIds) {
    const n = Number(String(id).replace(/^[a-z]+/, ''));
    if (Number.isFinite(n) && n > counter) counter = n;
  }
}
