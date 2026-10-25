# CoFloor

An AI project coordination dashboard with a four-column Kanban board, direct employee assignments, task details and project activity.

The current scenario is the fictional Red Bull Citrus Edition X launch. Its original requirements document is included and passed in full to the Agent adapter. Start project calls the live model to generate execution tasks, select staff and a project manager, then enters In project. About five seconds later it injects the document's afternoon sick leave; the model asks the manager for a decision and applies validated staffing changes. Reset immediately starts a new allocation. Discord delivery and manager input use a visibly labeled test channel.

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

See [the app README](qubemc-demo/README.md) for the board and Agent contract, [project structure](qubemc-demo/PROJECT_STRUCTURE.md) for module details, and [the original project requirements](qubemc-demo/data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md). Real inference drives setup, exception analysis and decision interpretation. Human approval gates are excluded from this demo; real Discord transport remains separate integration work.
