# RPG careers and property

Ships are one productive asset class, not the default character identity.
Property, contracts, offices, warehouses, concessions, information, debt, and
local influence are also viable routes to wealth and power. A stationary career
can start and remain at the starting site while still making active RPG choices.

Initial property careers include landlords, warehouse factors, market arcade
owners, berth concessionaires, and property clerks. These starts own a property
platform and do not require an owned or assigned ship. Property play should focus
on rent posture, tenant screening, maintenance, storage conversion, services,
refinancing, managers, local politics, and delegated logistics.

The first implementation is data-backed and system-backed in
`js/systems/properties.js` and `js/config/properties.js`. It now includes
tenant economic profiles (`inspectionRisk`, `maintenanceLoad`,
`reputationEffect`, `contractFlow`, commodity focus, and leasing needs),
deterministic daily economics, supply-chain-aware recommendations, nearby
company tenant matching, and stationary contract opportunities. Remaining hooks
include deeper people/faction event consequences, richer manager hiring, and
command wiring for every property action.
