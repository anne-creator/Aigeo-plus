# Imported company inputs

Source: Anne-provided `ai-ceo-us-agency-1000-en/`, dataset `bridgewell-us-agency-1000-en-v2`.

All ten JSON files are byte-for-byte copies verified against the source manifest. `import-manifest.json` records their hashes and row counts. The source metadata marks these records synthetic; the dashboard retains that provenance.

This directory contains 1,000 employee records, 17 departments, 72 roles, 99 teams, 14,000 calendar days, 14,000 daily capacity rows and 30,625 bookings. Original skill levels, permissions, employee IDs, time zones, reporting relationships and availability constraints are preserved for the future local runtime. Discord identity bindings are unset in the provided data and have not been activated.

Only a compact projection is shipped in the frontend (`src/company-data.json`). `CompanyInput.source.resources` points to these full local files for a future runtime adapter; these paths are relative to the project root, not public web URLs. Raw personnel / calendar files are not copied to the static build.

The projection's `availableHours` is remaining capacity on 2026-10-26, not gross daily capacity and not a feasibility check for a specific task window. Actual eligibility requires the original calendars / bookings plus task constraints. Preserve America/Los_Angeles time zone handling across the November 1 DST change.

Regenerate from a replacement package:

```sh
python3 scripts/import_company.py /path/to/ai-ceo-us-agency-1000-en
```

The importer validates source hashes, unique IDs, department headcounts and reference-day capacity before writing. No source scripts are executed. Workflow recommendations, demo event logs, ranking fixtures, model schema, project brief and task files were not adopted by this personnel import. The two-moment P0 scope remains unchanged; development assignments are still marked mock.
