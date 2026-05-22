from __future__ import annotations

from typing import Any, ClassVar, Sequence

from .market_resolver import MarketResolver, MarketResult


class TurnRunner:
    CATEGORY_PRIORITY: ClassVar[dict[str, int]] = {
        "factor": 0,
        "intermediate": 1,
        "final": 2,
    }
    EPSILON: float = 1e-9

    def __init__(self, resolver: MarketResolver) -> None:
        self._resolver = resolver

    def step(self, economy: Any) -> list[MarketResult]:
        snapshot = economy.model_copy(deep=True)
        results: list[MarketResult] = []

        try:
            for market in self._ordered_markets(economy):
                result = self._resolver.resolve(market, economy)
                applied_result = self._apply_market_result(
                    economy=economy,
                    market=market,
                    result=result,
                )
                results.append(applied_result)

            economy.increment_turn()
            return results
        except Exception:
            economy.agents = snapshot.agents
            economy.markets = snapshot.markets
            economy.goods = snapshot.goods
            economy.transactions = snapshot.transactions
            economy.current_turn = snapshot.current_turn
            economy.global_params = snapshot.global_params
            economy.aggregate_metrics = snapshot.aggregate_metrics
            raise

    def _ordered_markets(self, economy: Any) -> list[Any]:
        eligible: list[tuple[int, str, Any]] = []

        for market in economy.markets:
            if not getattr(market, "is_active", False):
                continue
            good = economy.get_good(market.good_id)
            if good is None:
                continue
            rank = self.CATEGORY_PRIORITY.get(str(good.category), 99)
            tie_breaker = getattr(market, "name", None) or str(getattr(market, "id", ""))
            eligible.append((rank, str(tie_breaker), market))

        eligible.sort(key=lambda item: (item[0], item[1]))
        return [item[2] for item in eligible]

    def _validate_transactions(self, economy: Any, transactions: Sequence[Any]) -> None:
        buyer_spend: dict[str, float] = {}
        seller_outflows: dict[tuple[str, str], float] = {}

        for transaction in transactions:
            buyer = economy.get_agent(transaction.buyer_id)
            seller = economy.get_agent(transaction.seller_id)
            if buyer is None:
                raise ValueError(f"Buyer not found for transaction: {transaction.buyer_id}")
            if seller is None:
                raise ValueError(f"Seller not found for transaction: {transaction.seller_id}")

            quantity = float(transaction.quantity)
            price = float(transaction.price)
            if quantity < -self.EPSILON:
                raise ValueError(f"Transaction quantity must be non-negative: {quantity}")
            if price < -self.EPSILON:
                raise ValueError(f"Transaction price must be non-negative: {price}")

            normalized_quantity = 0.0 if abs(quantity) <= self.EPSILON else quantity
            normalized_price = 0.0 if abs(price) <= self.EPSILON else price
            value = normalized_quantity * normalized_price

            buyer_spend[transaction.buyer_id] = buyer_spend.get(transaction.buyer_id, 0.0) + value
            outflow_key = (transaction.seller_id, transaction.good_id)
            seller_outflows[outflow_key] = seller_outflows.get(outflow_key, 0.0) + normalized_quantity

        for buyer_id, spend in buyer_spend.items():
            buyer = economy.get_agent(buyer_id)
            if buyer is None:
                raise ValueError(f"Buyer not found for transaction batch: {buyer_id}")
            buyer_cash = float(buyer.cash_balance)
            if buyer_cash < spend - self.EPSILON:
                raise ValueError(
                    f"Buyer {buyer_id} has insufficient cash for transaction batch: "
                    f"{buyer_cash} < {spend}"
                )

        for key, outflow_quantity in seller_outflows.items():
            seller_id, good_id = key
            seller = economy.get_agent(seller_id)
            if seller is None:
                raise ValueError(f"Seller not found for transaction batch: {seller_id}")
            seller_inventory = float(seller.inventory.get(good_id, 0.0))
            if seller_inventory < outflow_quantity - self.EPSILON:
                raise ValueError(
                    f"Seller {seller_id} has insufficient inventory for {good_id} in "
                    f"transaction batch: {seller_inventory} < {outflow_quantity}"
                )

    def _apply_market_result(self, *, economy: Any, market: Any, result: MarketResult) -> MarketResult:
        self._validate_transactions(economy, result.transactions)

        for transaction in result.transactions:
            self._apply_transaction(economy=economy, transaction=transaction)

        for transaction in result.transactions:
            economy.add_transaction(transaction)

        actual_quantity = float(sum(float(txn.quantity) for txn in result.transactions))
        actual_quantity = 0.0 if abs(actual_quantity) <= self.EPSILON else actual_quantity
        market_price = result.new_price if result.new_price is not None else result.clearing_price
        market.record_turn_results(price=market_price, quantity=actual_quantity)

        if result.quantity_traded != actual_quantity:
            return result.with_quantity(actual_quantity)
        return result

    def _apply_transaction(self, *, economy: Any, transaction: Any) -> None:
        buyer = economy.get_agent(transaction.buyer_id)
        seller = economy.get_agent(transaction.seller_id)
        if buyer is None:
            raise ValueError(f"Buyer not found for transaction: {transaction.buyer_id}")
        if seller is None:
            raise ValueError(f"Seller not found for transaction: {transaction.seller_id}")

        quantity = float(transaction.quantity)
        price = float(transaction.price)
        if quantity < -self.EPSILON:
            raise ValueError(f"Transaction quantity must be non-negative: {quantity}")
        if price < -self.EPSILON:
            raise ValueError(f"Transaction price must be non-negative: {price}")

        normalized_quantity = 0.0 if abs(quantity) <= self.EPSILON else quantity
        normalized_price = 0.0 if abs(price) <= self.EPSILON else price
        transaction_value = normalized_price * normalized_quantity

        seller_inventory = float(seller.inventory.get(transaction.good_id, 0.0))
        buyer_cash = float(buyer.cash_balance)

        if buyer_cash < transaction_value - self.EPSILON:
            raise ValueError(
                f"Buyer {transaction.buyer_id} has insufficient cash: "
                f"{buyer_cash} < {transaction_value}"
            )
        if seller_inventory < normalized_quantity - self.EPSILON:
            raise ValueError(
                f"Seller {transaction.seller_id} has insufficient inventory for "
                f"{transaction.good_id}: {seller_inventory} < {normalized_quantity}"
            )

        new_buyer_cash = buyer_cash - transaction_value
        new_seller_cash = float(seller.cash_balance) + transaction_value
        buyer.cash_balance = 0.0 if abs(new_buyer_cash) <= self.EPSILON else new_buyer_cash
        seller.cash_balance = 0.0 if abs(new_seller_cash) <= self.EPSILON else new_seller_cash
        seller.update_inventory(transaction.good_id, -normalized_quantity)
        buyer.update_inventory(transaction.good_id, normalized_quantity)

        seller_new_inventory = float(seller.inventory.get(transaction.good_id, 0.0))
        buyer_new_inventory = float(buyer.inventory.get(transaction.good_id, 0.0))
        if abs(seller_new_inventory) <= self.EPSILON:
            seller.inventory[transaction.good_id] = 0.0
        if abs(buyer_new_inventory) <= self.EPSILON:
            buyer.inventory[transaction.good_id] = 0.0
