# Contributing

## Language

Write all text in ASD-STE100 Simplified Technical English. This rule
applies to documents, code comments, names, log text, and commit
messages.

- Use short sentences. Use a maximum of 20 words in an instruction and
  25 words in a description.
- Use the active voice.
- Use the imperative form for instructions.
- Use one word for one meaning.

## Code

- Use plain JavaScript with native ES modules. Do not add a build tool
  or a bundler.
- Do not add dependencies.
- Keep the game logic in `src/core/`. These modules must not import
  three.js and must not use the DOM.
- Put the tests in `test/`. The tests import only modules from
  `src/core/`. Use only `node:test` and `node:assert`.
- Use only relative paths for the files of the game.
- When you add a file to the game, add it to the `FILES` list in
  `sw.js`, and to the deploy step in `.github/workflows/pages.yml` if
  it is in a new folder. A test makes sure that `sw.js` keeps all files.
- Do not change `const VERSION = 'dev';` in `sw.js`. The deploy writes
  the version of each deploy into that line. On a local server, the
  version `dev` always gets the newest files.

## Accessibility

All children must be able to play. For each change, check these points:

- Each button has an `aria-label`. A picture alone is not enough for a
  screen reader.
- The game works with only a keyboard, and with only the easy controls.
- The news of the game goes through `announce()`, so that screen readers
  and the Talk setting get it.
- Color is never the only difference. Use a size, a shape or a picture
  too.
- New motion stops when the Less motion setting is on.
- A new pop-up does not cover a dialog that is open.

## Tests

Run the tests before each commit:

```sh
npm test
```
