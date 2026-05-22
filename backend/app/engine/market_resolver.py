from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any


@dataclass(slots=True)
class MarketResult:
    clearing_price: float
    quantity_traded: float
    transactions: list[Any]
    new_price: float | None = None

    def with_quantity(self, quantity: float) -> "MarketResult":
        return replace(self, quantity_traded=quantity)


class MarketResolver:
    def resolve(self, market: Any, economy: Any) -> MarketResult:
        raise NotImplementedError
