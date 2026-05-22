from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from backend.app.engine.agent_behavior import (
    _build_production_input_bundle,
    compute_firm_output_supply,
)


@dataclass
class Good:
    id: str
    category: str


@dataclass
class Firm:
    inventory: dict[str, float] = field(default_factory=dict)
    production_parameters: dict[str, list[str]] = field(default_factory=dict)
    production_function: object | None = None


@dataclass
class Economy:
    goods: dict[str, Good]


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


def test_compute_output_supply_with_only_output_inventory_no_phantom_production() -> None:
    def production_fn(inputs: dict[str, float]) -> float:
        return sum(inputs.values())

    firm = Firm(
        inventory={"car": 12.0},
        production_parameters={},
        production_function=production_fn,
    )
    economy = Economy(goods={"car": Good(id="car", category="final")})

    supply = compute_firm_output_supply(firm=firm, economy=economy, output_good_id="car")

    assert supply == pytest.approx(12.0)


def test_compute_output_supply_allows_factor_and_intermediate_production() -> None:
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

    supply = compute_firm_output_supply(firm=firm, economy=economy, output_good_id="car")

    assert supply == pytest.approx(5.0)


def test_compute_output_supply_allows_explicit_final_input_when_declared() -> None:
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

    supply = compute_firm_output_supply(firm=firm, economy=economy, output_good_id="car")

    assert supply == pytest.approx(3.5)
