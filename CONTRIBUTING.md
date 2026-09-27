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
- When you change a game file, change the `CACHE` name in `sw.js`, so
  that the installed app gets a clean copy.

## Tests

Run the tests before each commit:

```sh
npm test
```
