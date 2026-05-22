from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import pytest

from backend.app.engine.agent_behavior import (
    _build_production_input_bundle,
    compute_firm_output_capacity,
    compute_firm_output_supply,
)


@dataclass
class Good:
    id: str
    category: str


@dataclass
class Firm:
    inventory: dict[object, float] = field(default_factory=dict)
    production_parameters: dict[str, list[str]] = field(default_factory=dict)
    production_function: Callable[[dict[str, float]], float] | None = None


@dataclass
class Economy:
    goods: dict[object, Good]


def test_build_input_bundle_excludes_output_good() -> None:
    firm = Firm(
        inventory={"car": 10.0, "labor": 4.0, "steel": 6.0},
        production_parameters={},
    )
    economy = Economy(
        goods={
            "car": Good(id="car", category="final"),
            "labor": Good(id="labor", category="factor"),
            "steel": Good(id="steel", category="intermediate"),
        }
    )

    bundle = _build_production_input_bundle(firm=firm, economy=economy, output_good_id="car")

    assert bundle == {"labor": 4.0, "steel": 6.0}


def test_build_input_bundle_supports_non_string_keys() -> None:
    firm = Firm(inventory={1: 3.0, 2: 4.0})
    economy = Economy(
        goods={
            "1": Good(id="1", category="factor"),
            "2": Good(id="2", category="final"),
        }
    )

    bundle = _build_production_input_bundle(firm=firm, economy=economy, output_good_id="x")

    assert bundle == {"1": 3.0}


def test_compute_output_supply_with_only_output_inventory_no_phantom_production() -> None:
    def production_fn(inputs: dict[str, float]) -> float:
        return sum(inputs.values())

    firm = Firm(
        inventory={"car": 12.0, "labor": 4.0},
        production_parameters={},
        production_function=production_fn,
    )
    economy = Economy(
        goods={
            "car": Good(id="car", category="final"),
            "labor": Good(id="labor", category="factor"),
        }
    )

    supply = compute_firm_output_supply(firm=firm, economy=economy, output_good_id="car")

    assert supply == pytest.approx(12.0)


def test_compute_output_capacity_allows_factor_and_intermediate_production() -> None:
    def production_fn(inputs: dict[str, float]) -> float:
        labor = inputs.get("labor", 0.0)
        steel = inputs.get("steel", 0.0)
        return min(labor, steel)

    firm = Firm(
        inventory={"car": 2.0, "labor": 5.0, "steel": 3.0, "food": 7.0},
        production_parameters={},
        production_function=production_fn,
    )
    economy = Economy(
        goods={
            "car": Good(id="car", category="final"),
            "labor": Good(id="labor", category="factor"),
            "steel": Good(id="steel", category="intermediate"),
            "food": Good(id="food", category="final"),
        }
    )

    capacity = compute_firm_output_capacity(firm=firm, economy=economy, output_good_id="car")

    assert capacity == pytest.approx(3.0)


def test_compute_output_capacity_allows_explicit_final_input_when_declared() -> None:
    def production_fn(inputs: dict[str, float]) -> float:
        return inputs.get("design", 0.0)

    firm = Firm(
        inventory={"car": 1.0, "design": 2.5},
        production_parameters={"input_goods": ["design"]},
        production_function=production_fn,
    )
    economy = Economy(
        goods={
            "car": Good(id="car", category="final"),
            "design": Good(id="design", category="final"),
        }
    )

    capacity = compute_firm_output_capacity(firm=firm, economy=economy, output_good_id="car")

    assert capacity == pytest.approx(2.5)


def test_compute_output_capacity_calls_function_with_empty_bundle() -> None:
    called_inputs: list[dict[str, float]] = []

    def production_fn(inputs: dict[str, float]) -> float:
        called_inputs.append(inputs)
        return 1.0

    firm = Firm(
        inventory={"car": 1.0},
        production_parameters={},
        production_function=production_fn,
    )
    economy = Economy(goods={"car": Good(id="car", category="final")})

    capacity = compute_firm_output_capacity(firm=firm, economy=economy, output_good_id="car")

    assert capacity == pytest.approx(1.0)
    assert called_inputs == [{}]
