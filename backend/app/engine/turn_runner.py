from __future__ import annotations

from typing import Any

from .market_resolver import MarketResolver, MarketResult


class TurnRunner:
    def __init__(self, resolver: MarketResolver | None = None) -> None:
        self._resolver = resolver if resolver is not None else MarketResolver()

    def step(self, economy: Any) -> list[MarketResult]:
        results: list[MarketResult] = []
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

    def _ordered_markets(self, economy: Any) -> list[Any]:
        category_priority: dict[str, int] = {
            "factor": 0,
            "intermediate": 1,
            "final": 2,
        }
        eligible: list[tuple[int, str, Any]] = []

        for market in economy.markets:
            if not getattr(market, "is_active", False):
                continue
            good = economy.get_good(market.good_id)
            if good is None:
                continue
            rank = category_priority.get(str(good.category), 99)
            tie_breaker = getattr(market, "name", None) or str(getattr(market, "id", ""))
            eligible.append((rank, str(tie_breaker), market))

        eligible.sort(key=lambda item: (item[0], item[1]))
        return [item[2] for item in eligible]

    def _apply_market_result(self, *, economy: Any, market: Any, result: MarketResult) -> MarketResult:
        for transaction in result.transactions:
            self._apply_transaction(economy=economy, transaction=transaction)
            economy.add_transaction(transaction)

        actual_quantity = float(sum(float(txn.quantity) for txn in result.transactions))
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
        transaction_value = price * quantity

        seller_inventory = float(seller.inventory.get(transaction.good_id, 0.0))
        buyer_cash = float(buyer.cash_balance)

        if buyer_cash < transaction_value:
            raise ValueError(
                f"Buyer {transaction.buyer_id} has insufficient cash: "
                f"{buyer_cash} < {transaction_value}"
            )
        if seller_inventory < quantity:
            raise ValueError(
                f"Seller {transaction.seller_id} has insufficient inventory for "
                f"{transaction.good_id}: {seller_inventory} < {quantity}"
            )

        buyer.cash_balance -= transaction_value
        seller.cash_balance += transaction_value
        seller.update_inventory(transaction.good_id, -quantity)
        buyer.update_inventory(transaction.good_id, quantity)
