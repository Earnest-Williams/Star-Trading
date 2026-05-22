from __future__ import annotations

from typing import Any, Callable


def _build_production_input_bundle(
    *, firm: Any, economy: Any, output_good_id: str
) -> dict[str, float]:
    """Build production inputs from firm inventory, excluding the output good."""
    bundle: dict[str, float] = {}
    inventory: dict[Any, Any] = getattr(firm, "inventory", {})
    production_params: dict[str, Any] = getattr(firm, "production_parameters", {})
    declared_inputs: set[str] = set()
    maybe_inputs = production_params.get("input_goods")
    if isinstance(maybe_inputs, list):
        declared_inputs = {str(item) for item in maybe_inputs}

    goods_mapping: dict[Any, Any] = getattr(economy, "goods", {})
    output_good_str = str(output_good_id)

    for good_id, quantity in inventory.items():
        good_id_str = str(good_id)
        if good_id_str == output_good_str:
            continue

        good = goods_mapping.get(good_id)
        if good is None:
            good = goods_mapping.get(good_id_str)

        category = ""
        if good is not None:
            category = str(getattr(good, "category", ""))

        is_valid_input_category = category in {"factor", "intermediate"}
        is_explicitly_declared_input = good_id_str in declared_inputs
        if not is_valid_input_category and not is_explicitly_declared_input:
            continue

        bundle[good_id_str] = float(quantity)

    return bundle


def compute_firm_output_capacity(*, firm: Any, economy: Any, output_good_id: str) -> float:
    """Compute potential producible output from current input inventory only."""
    production_fn: Callable[[dict[str, float]], float] | None = getattr(
        firm,
        "production_function",
        None,
    )
    if production_fn is None:
        return 0.0

    input_bundle = _build_production_input_bundle(
        firm=firm,
        economy=economy,
        output_good_id=output_good_id,
    )
    return float(production_fn(input_bundle))


def compute_firm_output_supply(*, firm: Any, economy: Any, output_good_id: str) -> float:
    """Compute currently saleable output supply from existing output inventory only."""
    _ = economy
    inventory: dict[Any, Any] = getattr(firm, "inventory", {})
    return float(inventory.get(output_good_id, inventory.get(str(output_good_id), 0.0)))
