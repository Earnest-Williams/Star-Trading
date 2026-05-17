export const PERSON_ROLES = Object.freeze([
    "sales_director",
    "freight_manager",
    "dockmaster",
    "customs_officer",
    "polity_envoy",
    "local_councillor",
    "union_rep",
    "factor",
    "fixer"
]);

export const PERSON_SERVICES_BY_ROLE = Object.freeze({
    sales_director: Object.freeze(["orders", "discounts"]),
    freight_manager: Object.freeze(["orders", "intel"]),
    dockmaster: Object.freeze(["parts", "discounts", "permits"]),
    customs_officer: Object.freeze(["permits", "intel"]),
    polity_envoy: Object.freeze(["permits", "intel"]),
    local_councillor: Object.freeze(["permits", "orders"]),
    union_rep: Object.freeze(["orders", "discounts"]),
    factor: Object.freeze(["parts", "orders", "discounts", "intel"]),
    fixer: Object.freeze(["parts", "orders", "permits", "intel"])
});

export const PERSON_NAME_PARTS = Object.freeze({
    given: Object.freeze(["Mara", "Tovin", "Ilyra", "Cass", "Rook", "Anja", "Soren", "Vela", "Niko", "Juno", "Pax", "Edda"]),
    family: Object.freeze(["Vale", "Korr", "Nadir", "Sable", "Quinn", "Mar", "Dax", "Ives", "Sol", "Rhyne", "Ames", "Kade"])
});
