from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from backend.app.engine.market_resolver import MarketResolver, MarketResult
from backend.app.engine.turn_runner import TurnRunner


@dataclass
class Good:
    id: str
    category: str


@dataclass
class Agent:
    id: str
    cash_balance: float
    inventory: dict[str, float] = field(default_factory=dict)

    def update_inventory(self, good_id: str, delta: float) -> None:
        self.inventory[good_id] = self.inventory.get(good_id, 0.0) + delta


@dataclass
class Transaction:
    buyer_id: str
    seller_id: str
    good_id: str
    price: float
    quantity: float


@dataclass
class Market:
    id: str
    name: str
    good_id: str
    is_active: bool = True
    price_history: list[float] = field(default_factory=list)
    quantity_history: list[float] = field(default_factory=list)

    def record_turn_results(self, *, price: float, quantity: float) -> None:
        self.price_history.append(price)
        self.quantity_history.append(quantity)


@dataclass
class EconomyState:
    goods: dict[str, Good]
    agents: dict[str, Agent]
    markets: list[Market]
    current_turn: int = 0
    transactions: list[Transaction] = field(default_factory=list)

    def get_good(self, good_id: str) -> Good | None:
        return self.goods.get(good_id)

    def get_agent(self, agent_id: str) -> Agent | None:
        return self.agents.get(agent_id)

    def add_transaction(self, transaction: Transaction) -> None:
        self.transactions.append(transaction)

    def increment_turn(self) -> None:
        self.current_turn += 1


class StaticResolver(MarketResolver):
    def __init__(self, responses: dict[str, MarketResult]) -> None:
        self._responses = responses
        self.seen: list[str] = []

    def resolve(self, market: Market, economy: EconomyState) -> MarketResult:
        _ = economy
        self.seen.append(market.id)
        return self._responses[market.id]


def test_turn_runner_applies_market_transaction_and_advances_turn() -> None:
    buyer = Agent(id="buyer", cash_balance=100.0, inventory={"food": 1.0})
    seller = Agent(id="seller", cash_balance=20.0, inventory={"food": 10.0})
    market = Market(id="m1", name="Food Market", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txn = Transaction(buyer_id="buyer", seller_id="seller", good_id="food", price=5.0, quantity=3.0)
    resolver = StaticResolver(
        {
            "m1": MarketResult(
                clearing_price=4.8,
                quantity_traded=3.0,
                transactions=[txn],
                new_price=5.1,
            )
        }
    )

    runner = TurnRunner(resolver=resolver)
    results = runner.step(economy)

    assert len(results) == 1
    assert buyer.cash_balance == pytest.approx(85.0)
    assert seller.cash_balance == pytest.approx(35.0)
    assert buyer.inventory["food"] == pytest.approx(4.0)
    assert seller.inventory["food"] == pytest.approx(7.0)
    assert economy.transactions == [txn]
    assert market.price_history == [5.1]
    assert market.quantity_history == [3.0]
    assert economy.current_turn == 1


def test_turn_runner_resolves_markets_in_economic_order() -> None:
    goods = {
        "labor": Good(id="labor", category="factor"),
        "steel": Good(id="steel", category="intermediate"),
        "car": Good(id="car", category="final"),
    }
    markets = [
        Market(id="final", name="Z Final", good_id="car"),
        Market(id="intermediate", name="B Inter", good_id="steel"),
        Market(id="factor", name="A Factor", good_id="labor"),
    ]
    economy = EconomyState(goods=goods, agents={}, markets=markets)
    resolver = StaticResolver(
        {
            "factor": MarketResult(clearing_price=1.0, quantity_traded=0.0, transactions=[]),
            "intermediate": MarketResult(clearing_price=1.0, quantity_traded=0.0, transactions=[]),
            "final": MarketResult(clearing_price=1.0, quantity_traded=0.0, transactions=[]),
        }
    )

    TurnRunner(resolver=resolver).step(economy)

    assert resolver.seen == ["factor", "intermediate", "final"]


def test_turn_runner_raises_on_insufficient_cash_without_partial_mutation() -> None:
    buyer = Agent(id="buyer", cash_balance=5.0, inventory={"food": 0.0})
    seller = Agent(id="seller", cash_balance=20.0, inventory={"food": 10.0})
    market = Market(id="m1", name="Food Market", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txn = Transaction(buyer_id="buyer", seller_id="seller", good_id="food", price=3.0, quantity=2.0)
    resolver = StaticResolver({"m1": MarketResult(clearing_price=3.0, quantity_traded=2.0, transactions=[txn])})

    with pytest.raises(ValueError, match="insufficient cash"):
        TurnRunner(resolver=resolver).step(economy)

    assert buyer.cash_balance == 5.0
    assert seller.cash_balance == 20.0
    assert buyer.inventory["food"] == 0.0
    assert seller.inventory["food"] == 10.0
    assert economy.transactions == []


def test_turn_runner_no_active_markets_still_increments_turn() -> None:
    market = Market(id="m1", name="Inactive", good_id="food", is_active=False)
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={},
        markets=[market],
    )

    results = TurnRunner(resolver=StaticResolver({})).step(economy)

    assert results == []
    assert economy.transactions == []
    assert economy.current_turn == 1


def test_turn_runner_records_actual_quantity_from_transactions() -> None:
    buyer = Agent(id="buyer", cash_balance=200.0)
    seller = Agent(id="seller", cash_balance=0.0, inventory={"food": 10.0})
    market = Market(id="m1", name="Food Market", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txns = [
        Transaction(buyer_id="buyer", seller_id="seller", good_id="food", price=2.0, quantity=2.0),
        Transaction(buyer_id="buyer", seller_id="seller", good_id="food", price=2.0, quantity=1.0),
    ]
    resolver = StaticResolver(
        {
            "m1": MarketResult(
                clearing_price=2.0,
                quantity_traded=999.0,
                transactions=txns,
            )
        }
    )

    results = TurnRunner(resolver=resolver).step(economy)

    assert results[0].quantity_traded == pytest.approx(3.0)
    assert market.quantity_history == [3.0]
