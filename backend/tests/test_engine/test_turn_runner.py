from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

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
    current_price: float = 1.0
    min_price: float = 0.01
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
    global_params: dict[str, float] = field(default_factory=dict)
    aggregate_metrics: dict[str, float] = field(default_factory=dict)

    def get_good(self, good_id: str) -> Good | None:
        return self.goods.get(good_id)

    def get_agent(self, agent_id: str) -> Agent | None:
        return self.agents.get(agent_id)

    def add_transaction(self, transaction: Transaction) -> None:
        self.transactions.append(transaction)

    def increment_turn(self) -> None:
        self.current_turn += 1

    def model_copy(self, *, deep: bool) -> "EconomyState":
        return deepcopy(self) if deep else self


class StaticResolver(MarketResolver):
    def __init__(self, responses: dict[str, MarketResult]) -> None:
        self._responses = responses
        self.seen: list[str] = []

    def resolve(self, market: Market, economy: EconomyState) -> MarketResult:
        _ = economy
        self.seen.append(market.id)
        return self._responses[market.id]


class RaiseOnSecondResolver(MarketResolver):
    def __init__(self, first: MarketResult) -> None:
        self._first = first
        self._calls = 0

    def resolve(self, market: Market, economy: EconomyState) -> MarketResult:
        _ = market
        _ = economy
        self._calls += 1
        if self._calls == 1:
            return self._first
        raise RuntimeError("resolver failure")


def test_turn_runner_applies_market_transaction_and_advances_turn() -> None:
    buyer = Agent(id="buyer", cash_balance=100.0, inventory={"food": 1.0})
    seller = Agent(id="seller", cash_balance=20.0, inventory={"food": 10.0})
    market = Market(id="m1", name="Food Market", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txn = Transaction(
        buyer_id="buyer", seller_id="seller", good_id="food", price=5.0, quantity=3.0
    )
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
            "intermediate": MarketResult(
                clearing_price=1.0, quantity_traded=0.0, transactions=[]
            ),
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
    txn = Transaction(
        buyer_id="buyer", seller_id="seller", good_id="food", price=3.0, quantity=2.0
    )
    resolver = StaticResolver(
        {
            "m1": MarketResult(
                clearing_price=3.0, quantity_traded=2.0, transactions=[txn]
            )
        }
    )

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
        Transaction(
            buyer_id="buyer",
            seller_id="seller",
            good_id="food",
            price=2.0,
            quantity=2.0,
        ),
        Transaction(
            buyer_id="buyer",
            seller_id="seller",
            good_id="food",
            price=2.0,
            quantity=1.0,
        ),
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


def test_turn_runner_rolls_back_all_state_on_later_market_failure() -> None:
    buyer = Agent(id="buyer", cash_balance=100.0, inventory={"food": 0.0})
    seller = Agent(id="seller", cash_balance=0.0, inventory={"food": 10.0})
    first_market = Market(id="m1", name="A", good_id="food")
    second_market = Market(id="m2", name="B", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[first_market, second_market],
        global_params={"tax": 0.1},
        aggregate_metrics={"gdp": 1.0},
    )
    snapshot = economy.model_copy(deep=True)
    txn = Transaction(
        buyer_id="buyer", seller_id="seller", good_id="food", price=5.0, quantity=3.0
    )
    resolver = RaiseOnSecondResolver(
        first=MarketResult(clearing_price=5.0, quantity_traded=3.0, transactions=[txn])
    )

    with pytest.raises(RuntimeError, match="resolver failure"):
        TurnRunner(resolver=resolver).step(economy)

    assert economy == snapshot


def test_turn_runner_market_atomicity_for_failed_batch() -> None:
    buyer = Agent(id="buyer", cash_balance=10.0, inventory={"food": 0.0})
    seller = Agent(id="seller", cash_balance=0.0, inventory={"food": 3.0})
    market = Market(id="m1", name="Food", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txns = [
        Transaction(
            buyer_id="buyer", seller_id="seller", good_id="food", price=1.0, quantity=2.0
        ),
        Transaction(
            buyer_id="buyer", seller_id="seller", good_id="food", price=1.0, quantity=2.0
        ),
    ]

    with pytest.raises(ValueError, match="insufficient inventory"):
        TurnRunner(resolver=StaticResolver({"m1": MarketResult(1.0, 4.0, txns)})).step(economy)

    assert buyer.cash_balance == 10.0
    assert seller.cash_balance == 0.0
    assert buyer.inventory["food"] == 0.0
    assert seller.inventory["food"] == 3.0
    assert economy.transactions == []
    assert market.price_history == []


def test_turn_runner_cumulative_cash_validation_prevents_partial_market_mutation() -> None:
    buyer = Agent(id="buyer", cash_balance=5.0, inventory={"food": 0.0})
    seller = Agent(id="seller", cash_balance=0.0, inventory={"food": 10.0})
    market = Market(id="m1", name="Food", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txns = [
        Transaction(
            buyer_id="buyer", seller_id="seller", good_id="food", price=3.0, quantity=1.0
        ),
        Transaction(
            buyer_id="buyer", seller_id="seller", good_id="food", price=3.0, quantity=1.0
        ),
    ]

    with pytest.raises(ValueError, match="transaction batch"):
        TurnRunner(resolver=StaticResolver({"m1": MarketResult(3.0, 2.0, txns)})).step(economy)

    assert buyer.cash_balance == 5.0
    assert seller.cash_balance == 0.0
    assert economy.transactions == []
    assert market.price_history == []


def test_turn_runner_epsilon_allows_tiny_float_residue() -> None:
    transaction_value = 0.1 + 0.2
    buyer_cash = transaction_value - 5e-10
    buyer = Agent(id="buyer", cash_balance=buyer_cash, inventory={"food": 0.0})
    seller = Agent(id="seller", cash_balance=0.0, inventory={"food": 1.0})
    market = Market(id="m1", name="Food", good_id="food")
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txn = Transaction(
        buyer_id="buyer", seller_id="seller", good_id="food", price=transaction_value, quantity=1.0
    )

    TurnRunner(resolver=StaticResolver({"m1": MarketResult(0.3, 1.0, [txn])})).step(economy)

    assert buyer.cash_balance == 0.0
    assert seller.cash_balance == pytest.approx(transaction_value)


def test_turn_runner_requires_resolver_constructor_argument() -> None:
    with pytest.raises(TypeError):
        TurnRunner()  # type: ignore[call-arg]


def test_market_settlement_invariants_and_history() -> None:
    buyer = Agent(id="buyer", cash_balance=100.0, inventory={"food": 1.0})
    seller = Agent(id="seller", cash_balance=20.0, inventory={"food": 10.0})
    market = Market(id="m1", name="Food Market", good_id="food", current_price=5.0)
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    transactions = [
        Transaction("buyer", "seller", "food", 5.0, 2.0),
        Transaction("buyer", "seller", "food", 5.0, 1.0),
    ]
    before_buyer_cash = buyer.cash_balance
    before_seller_cash = seller.cash_balance
    before_buyer_inventory = buyer.inventory["food"]
    before_seller_inventory = seller.inventory["food"]

    result = TurnRunner(
        resolver=StaticResolver(
            {"m1": MarketResult(clearing_price=5.0, quantity_traded=3.0, transactions=transactions, new_price=5.2)}
        )
    ).step(economy)[0]

    total_value = sum(txn.price * txn.quantity for txn in transactions)
    total_quantity = sum(txn.quantity for txn in transactions)

    assert before_buyer_cash - buyer.cash_balance == pytest.approx(total_value)
    assert seller.cash_balance - before_seller_cash == pytest.approx(total_value)
    assert buyer.inventory["food"] - before_buyer_inventory == pytest.approx(total_quantity)
    assert before_seller_inventory - seller.inventory["food"] == pytest.approx(total_quantity)
    assert buyer.cash_balance >= 0.0
    assert seller.cash_balance >= 0.0
    assert buyer.inventory["food"] >= 0.0
    assert seller.inventory["food"] >= 0.0
    assert sum(txn.quantity for txn in transactions) == pytest.approx(result.quantity_traded)
    assert total_value == pytest.approx(before_buyer_cash - buyer.cash_balance)
    assert economy.transactions == transactions
    assert market.quantity_history[-1] == pytest.approx(total_quantity)
    assert market.price_history[-1] == pytest.approx(5.2)


def test_turn_runner_sets_current_price_to_new_price() -> None:
    market = Market(id="m1", name="Food", good_id="food", current_price=10.0)
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={},
        markets=[market],
    )

    TurnRunner(
        resolver=StaticResolver(
            {"m1": MarketResult(clearing_price=10.0, quantity_traded=0.0, transactions=[], new_price=11.0)}
        )
    ).step(economy)

    assert market.current_price == pytest.approx(11.0)
    assert market.price_history[-1] == pytest.approx(11.0)


def test_turn_runner_fallback_new_price_equals_clearing_price() -> None:
    market = Market(id="m1", name="Food", good_id="food", current_price=3.0)
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={},
        markets=[market],
    )

    TurnRunner(
        resolver=StaticResolver(
            {"m1": MarketResult(clearing_price=4.0, quantity_traded=0.0, transactions=[], new_price=None)}
        )
    ).step(economy)

    assert market.current_price == pytest.approx(4.0)
    assert market.price_history[-1] == pytest.approx(4.0)


def test_market_result_clearing_price_distinct_from_new_price() -> None:
    market = Market(id="m1", name="Food", good_id="food", current_price=5.0)
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={},
        markets=[market],
    )
    result = TurnRunner(
        resolver=StaticResolver(
            {"m1": MarketResult(clearing_price=5.0, quantity_traded=0.0, transactions=[], new_price=5.5)}
        )
    ).step(economy)[0]

    assert result.clearing_price == pytest.approx(5.0)
    assert result.new_price == pytest.approx(5.5)
    assert market.current_price == pytest.approx(5.5)



def test_turn_runner_allows_transactions_within_current_inventory() -> None:
    buyer = Agent(id="buyer", cash_balance=100.0, inventory={"food": 0.0})
    seller = Agent(id="seller", cash_balance=0.0, inventory={"food": 4.0})
    market = Market(id="m1", name="Food", good_id="food", current_price=5.0)
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txns = [Transaction("buyer", "seller", "food", 5.0, 4.0)]

    TurnRunner(resolver=StaticResolver({"m1": MarketResult(5.0, 4.0, txns)})).step(economy)

    assert seller.inventory["food"] == pytest.approx(0.0)
    assert buyer.inventory["food"] == pytest.approx(4.0)


def test_turn_runner_rejects_transactions_exceeding_current_inventory() -> None:
    buyer = Agent(id="buyer", cash_balance=100.0, inventory={"food": 0.0})
    seller = Agent(id="seller", cash_balance=0.0, inventory={"food": 4.0})
    market = Market(id="m1", name="Food", good_id="food", current_price=5.0)
    economy = EconomyState(
        goods={"food": Good(id="food", category="final")},
        agents={"buyer": buyer, "seller": seller},
        markets=[market],
    )
    txns = [Transaction("buyer", "seller", "food", 5.0, 4.1)]

    with pytest.raises(ValueError, match="insufficient inventory"):
        TurnRunner(resolver=StaticResolver({"m1": MarketResult(5.0, 4.1, txns)})).step(economy)
