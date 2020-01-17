TypeScript transformer that inlines `className()` invocations from the `inline-class-name` module.

It is also recommended to use optimizing compiler that will be able to partially evaluate template literals and convert
them to [interned strings](https://en.wikipedia.org/wiki/String_interning).

```sh
$ npm i --save-dev inline-class-name ts-inline-class-name
```

Input:

```ts
import { className } from "inline-class-name";
import * as css from "row.css";

function p(locked: boolean, dragged: boolean) {
  return className({
    [css.Row]: true,
    [css.Locked]: locked,
    [css.Dragged]: dragged,
  });
}
```

Output:

```js
import * as css from "row.css";

function p(locked, dragged) {
  return (locked ? (dragged ? `${css.Row} ${css.Locked} ${css.Dragged}` : `${css.Row} ${css.Locked}`) : (dragged ? `${css.Row} ${css.Dragged}` : `${css.Row}`));
}
```

### Ignoring Invalid States

Input:

```ts
import { className } from "inline-class-name";
import * as css from "row.css";

function p(locked: boolean, dragged: boolean) {
  return className({
    [css.Row]: true,
    [css.Locked]: locked,
    [css.Dragged]: dragged,
  }, [[css.Locked, css.Dragged]]);
}
```

Output:

```js
import * as css from "row.css";

function p(locked, dragged) {
  return (locked ? `${css.Row} ${css.Locked}` : (dragged ? `${css.Row} ${css.Dragged}` : `${css.Row}`));
}
```
