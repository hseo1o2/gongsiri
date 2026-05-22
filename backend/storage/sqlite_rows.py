from __future__ import annotations

import json
import sqlite3
from typing import Any

Row = dict[str, Any]


class Columns:
    def __init__(self, values: Row) -> None:
        self.names = ", ".join(values)
        self.placeholders = ", ".join("?" for _ in values)
        self.updates = ", ".join(f"{name} = excluded.{name}" for name in values if name != "id")
        self.values = tuple(values.values())


def columns(values: Row) -> Columns:
    return Columns(values)


def row_dict(row: sqlite3.Row | None) -> Row:
    return dict(row) if row is not None else {}


def encode_json_fields(values: Row, fields: tuple[str, ...]) -> Row:
    encoded = dict(values)
    for field in fields:
        if field in encoded:
            encoded[f"{field}_json"] = json.dumps(encoded.pop(field), ensure_ascii=False)
    return encoded


def decode_json_fields(row: sqlite3.Row | None, mapping: dict[str, str]) -> Row:
    decoded = row_dict(row)
    for storage_key, output_key in mapping.items():
        if storage_key in decoded:
            decoded[output_key] = json.loads(decoded.pop(storage_key))
    return decoded
