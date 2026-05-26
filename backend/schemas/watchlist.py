from typing import Optional

from pydantic import BaseModel


class WatchlistItem(BaseModel):
    corp_code: str
    stock_code: str
    name: str
    market: str
    added_at: str
    last_checked: Optional[str] = None
