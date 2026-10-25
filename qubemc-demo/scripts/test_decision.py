#!/usr/bin/env python3
"""Send a ticket-routing question to the D1 decision model."""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def model_api_credential() -> str:
    if credential := os.environ.get("MODEL_API_AUTH"):
        return credential
    for directory in Path(__file__).resolve().parents[:4]:
        dotenv = directory / ".env"
        if not dotenv.is_file():
            continue
        for line in dotenv.read_text().splitlines():
            key, separator, value = line.partition("=")
            if separator and key.strip() == "MODEL_API_AUTH":
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                if value:
                    return value
    credential_file = Path.home() / ".config/builderbase/model-api-credentials"
    return credential_file.read_text().strip() if credential_file.exists() else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "ticket",
        nargs="?",
        default="A customer reports being charged twice for one order.",
    )
    parser.add_argument("--url", default="https://models.qubemc.com/decision/v1/systemone")
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
    if urlsplit(args.url).hostname == "models.qubemc.com":
        credential = model_api_credential()
        if not credential:
            print("Missing model API credential: set MODEL_API_AUTH, add it to .env, or create ~/.config/builderbase/model-api-credentials", file=sys.stderr)
            return 1
        headers["Authorization"] = "Basic " + base64.b64encode(credential.encode()).decode()
    request = Request(
        args.url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
    )

    started = time.perf_counter()
    try:
        with urlopen(request, timeout=120) as response:
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
