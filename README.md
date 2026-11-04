# bruno-sync-preview

**Review which handwritten scripts, tests and variables could be lost before re-importing OpenAPI into Bruno.**

Offline replacement-risk preview for Bruno collection JSON. Keep Bruno's importer; review the diff before replacing your collection.

## Why this exists

Bruno already provides OpenAPI import and Sync. This project consumes official collection JSON and summarizes changes to handwritten configuration for code review, terminals and CI. It does not run requests, start Bruno or connect to a service, and does not implement another API client, converter or synchronizer.

The model is **what would change if the candidate collection replaced the current collection**, not a simulation of the merge logic in each Bruno Sync version. If upstream Sync preserves a setting, a reported risk still needs human review. This tool does not replace official backup or restore features.

## Installation and a 30-second example

Requires Node.js 22 or newer. Use the source checkout; this project has not been published to npm.

```sh
git clone https://github.com/DrEli7/bruno-sync-preview.git
cd bruno-sync-preview
npm ci --ignore-scripts
npm run demo
npm test
```

All examples are synthetic. The current snapshot contains a handwritten test, a request script and an environment; the candidate changes a path and adds a request. The report identifies removed or changed fields without printing their values.

## Use with real collections

1. Export the existing collection from Bruno as **Bruno collection JSON**, saved as `current.json`.
2. Use your installed official Bruno CLI to generate a separate JSON file from the new OpenAPI document:

```sh
bru import openapi --source api.yml --output-file candidate.json --collection-name "My API"
```

3. Compare the snapshots:

```sh
node src/cli.mjs current.json candidate.json
node src/cli.mjs current.json candidate.json --format json
node src/cli.mjs current.json candidate.json --fail-on-risk > review.md
```

The tool reads only the two explicit files and writes to stdout. It does not modify inputs, access the network or execute scripts. File redirection is performed by your shell; do not redirect to an input file.

| Exit code | Meaning |
| --- | --- |
| 0 | Report generated; differences do not fail the command by default |
| 1 | `--fail-on-risk` was enabled and existing items or fields changed or disappeared |
| 2 | Argument, JSON or unsupported-format error |

## Comparison scope

- Exact matching by the **full folder-name array plus request name**, avoiding UIDs that can change on each import.
- HTTP/GraphQL methods, URLs, scripts, tests, variables, assertions, authentication, headers, params, bodies and documentation.
- Inherited folder request settings, collection root settings, environments and `brunoConfig`.
- Added/removed items, request types, examples, settings, tags and descriptions.
- Duplicate names at the same path and unsupported websocket/gRPC/JS/app items are rejected to avoid silent omissions.
- Item identity ignores top-level `uid`, ordering `seq`, local `pathname` and `filename`. Only this item metadata is excluded. Fields with the same names inside request values are still compared strictly.

Reports contain **no field values, URLs, authentication, scripts or request bodies**. Folder and request names are included; check that names contain no private information before sharing a report.

Risk counts refer to risky change records, not unique requests. Reordered arrays or regenerated UIDs inside nested fields can produce conservative field risks. Renames and moves appear as removal plus addition; intent is not inferred. Only the listed fields are compared. Unknown custom plugin fields, `.bru` source directories and OpenCollection YAML are unsupported. API results and backup archives are not valid inputs.

## Library API

```js
import { previewSync, toMarkdown } from './src/index.mjs';
const report = previewSync(currentCollection, generatedCollection);
console.log(toMarkdown(report));
```

## Upstream references and verification

- [Official Bruno CLI import documentation](https://github.com/usebruno/bruno/blob/main/packages/bruno-cli/readme.md)
- [Bruno collection types](https://github.com/usebruno/bruno/blob/main/packages/bruno-schema-types/src/collection/collection.ts)
- [Bruno HTTP request types](https://github.com/usebruno/bruno/blob/main/packages/bruno-schema-types/src/requests/http.ts)

Compatibility tests use official `@usebruno/converters` 0.25.0 to convert a small OpenAPI document and pass the real result to the previewer, alongside handwritten fixtures. Other tests cover duplicate names, path collisions, omission of sensitive values, inherited settings, CLI exit codes and input preservation. Runtime code uses only Node's standard library; the official converter is a test dependency. GitHub Actions covers Windows/Linux and Node 22/24.

Bruno is a trademark of its maintainers. This is an independent community tool. MIT License.
