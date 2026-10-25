# CoFloor

An AI project coordination dashboard with a four-column Kanban board, direct employee assignments, task details and project activity.

The current scenario is the fictional Red Bull Citrus Edition X launch. Its original requirements document is included and passed in full to the Agent adapter. Reference mode assigns the document's example strategist and Creative Director; live mode requires a runtime implementing the Red Bull intake contract. The frontend never substitutes reference assignments for failed live results.

## Run locally

```sh
cd qubemc-demo
npm ci
npm run dev
```

The source directory keeps its existing name for compatibility. The service and npm package are named **CoFloor**.

## Validate

```sh
cd qubemc-demo
npm test
npm run test:board
npm run build
```

See [the app README](qubemc-demo/README.md) for the board and Agent contract, [project structure](qubemc-demo/PROJECT_STRUCTURE.md) for module details, and [the original project requirements](qubemc-demo/data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md). Real inference, Discord and the complete eight-node workflow are separate integration work; any earlier three-workstream runtime must be updated for this scenario.
