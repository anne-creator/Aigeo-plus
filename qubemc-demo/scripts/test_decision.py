#!/usr/bin/env python3
"""Send a ticket-routing question to the D1 decision model."""

import argparse
import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request
from local_model_http import open_local_model


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "ticket",
        nargs="?",
        default="A customer reports being charged twice for one order.",
    )
    parser.add_argument("--url", default="http://100.89.121.112:8001/v1/systemone")
    args = parser.parse_args()

    body = {
        "model": "coo-decision",
        "state": {"ticket": args.ticket},
        "questions": {
            "team": {
                "type": "choice",
                "instructions": "Which team should handle this ticket?",
                "criteria": {
                    "billing": "Payments and refunds",
                    "shipping": "Deliveries",
                    "security": "Account access",
                },
            }
        },
    }
    headers = {"Content-Type": "application/json", "User-Agent": "curl/8.5.0"}
    request = Request(
        args.url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
    )

    started = time.perf_counter()
    try:
        with open_local_model(request, service="decision", timeout=120) as response:
            result = json.load(response)
    except HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}", file=sys.stderr)
        return 1
    except URLError as exc:
        print(f"Connection failed: {exc.reason}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2))
    print(f"\nLatency: {time.perf_counter() - started:.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
