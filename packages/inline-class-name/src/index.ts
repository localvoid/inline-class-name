/**
 * Creates className string by concatenating object keys that have `true` value.
 *
 * @example
 *
 *     className({
 *       a: true,
 *       b: false,
 *       c: true,
 *     });
 *     // => "a c"
 *
 * @param classes Classes object.
 * @param invalid Invalid state list.
 * @returns className string.
 */
export function className(classes: { [key: string]: boolean }, invalid?: string[][]): string {
  if (process.env.NODE_ENV !== "production") {
    if (invalid !== void 0) {
      const index = new Map();
      let currentState = 0;
      for (const key in classes) {
        const k = index.size;
        index.set(key, k);
        if (classes[key] === true) {
          currentState |= 1 << k;
        }
      }
      const invalidBitSets = invalid.map((s) => {
        let state = 0;
        for (let i = 0; i < s.length; i++) {
          const k = index.get(s);
          if (k !== void 0) {
            state |= 1 << k;
          }
        }
        return state;
      });

      for (let i = 0; i < invalidBitSets.length; i++) {
        const b = invalidBitSets[i];
        if ((currentState & b) === b) {
          throw Error(`Invalid className state. Class name state in the invalid state list: ${invalid[i].join(",")}`);
        }
      }
    }
  }
  let result = "";
  for (const key in classes) {
    if (classes[key] === true) {
      if (result !== "") {
        result += " ";
      }
      result += key;
    }
  }
  return result;
}
