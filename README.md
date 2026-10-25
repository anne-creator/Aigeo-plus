# CoFloor

An AI project coordination dashboard for planning work, assigning team members, monitoring issues and recording worker decisions.

The current frontend is a local development demo. Model inference and Discord transport are not connected; a typed Agent adapter is provided for the local runtime.

## Run locally

```sh
cd qubemc-demo
npm ci
npm run dev
```

The source directory keeps its existing name for compatibility with current local workflows. The service and npm package are named **CoFloor**.

## Validate

```sh
cd qubemc-demo
npm test
npm run build
```

See [the app README](qubemc-demo/README.md) for the walkthrough and Agent integration contract, and [project structure](qubemc-demo/PROJECT_STRUCTURE.md) for implementation details. The logo is pending Anne’s review.
