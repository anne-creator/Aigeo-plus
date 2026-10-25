# CoFloor

An AI project coordination dashboard with a four-column Kanban board, direct employee assignments, task details and project activity.

The current scenario is the fictional Red Bull Citrus Edition X launch. Start project reads the original brief, generates execution tasks and assigns staff plus a project manager. Alex's actual reply in the configured Discord group reports the scenario sick leave; the model proposes replacements, and the manager must confirm the current proposal before reassignment is applied. There is no automatic leave timer.

English progress narration uses the local Qwen Ryan voice for allocation, Alex's blocker, the concrete AI proposal, verified Discord confirmation and resumed coordination. The browser provides mute, text updates and voice retry; speech failure does not stop project work.

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

See [the app README](qubemc-demo/README.md) for the board and Agent contract, [project structure](qubemc-demo/PROJECT_STRUCTURE.md) for module details, and [the original project requirements](qubemc-demo/data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md). Real inference drives setup, exception analysis and decision interpretation. Initial assignment is automatic; sick-leave reassignment requires the authenticated manager’s confirmation in Discord. See the app README for voice runtime requirements and verification limitations.
