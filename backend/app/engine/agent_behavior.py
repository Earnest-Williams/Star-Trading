from __future__ import annotations

from typing import Any


def _build_production_input_bundle(*, firm: Any, economy: Any, output_good_id: str) -> dict[str, float]:
    """Build a production input bundle excluding the output good itself."""
    good_categories: dict[str, str] = {}
    for good_id, good in getattr(economy, "goods", {}).items():
        category = getattr(good, "category", "")
        good_categories[str(good_id)] = str(category)

    bundle: dict[str, float] = {}
    inventory: dict[str, float] = getattr(firm, "inventory", {})
    production_params: dict[str, Any] = getattr(firm, "production_parameters", {})
    declared_inputs: set[str] = set()
    maybe_inputs = production_params.get("input_goods")
    if isinstance(maybe_inputs, list):
        declared_inputs = {str(item) for item in maybe_inputs}

    for good_id, quantity in inventory.items():
        normalized_good_id = str(good_id)
        if normalized_good_id == output_good_id:
            continue
        category = good_categories.get(normalized_good_id, "")
        is_valid_category = category in {"factor", "intermediate"}
        explicitly_allowed = normalized_good_id in declared_inputs
        if not is_valid_category and not explicitly_allowed:
            continue
        bundle[normalized_good_id] = float(quantity)
    return bundle


def compute_firm_output_supply(*, firm: Any, economy: Any, output_good_id: str) -> float:
    """Compute available output as existing inventory plus potential new production."""
    inventory: dict[str, float] = getattr(firm, "inventory", {})
    existing_output = float(inventory.get(output_good_id, 0.0))

    input_bundle = _build_production_input_bundle(
        firm=firm,
        economy=economy,
        output_good_id=output_good_id,
    )

    production_fn = getattr(firm, "production_function", None)
    producible_output = 0.0
    if production_fn is not None and len(input_bundle) > 0:
        producible_output = float(production_fn(input_bundle))

    return existing_output + producible_output
