// @ts-check

/** @typedef {'player'|'universe'|'economy'|'routes'|'captains'|'dialogue'|'persistence'|'uiRuntime'|'events'|'dataCargo'|'logisticsObjectives'} StateSliceName */
/** @typedef {{day:number, minuteOfDay:number}|null} PlayerTime */
/** @typedef {{cargo: CargoStock|null, name?:string|null, combatRating?:number|null}} ShipState */
/** @typedef {{ore?:number, org?:number, eq?:number, [key:string]:number|undefined}} CargoStock */
/** @typedef {{currentSector?:number|null, credits?:number|null, cargo?:CargoStock|null, ship?:ShipState|null, character?:object|null, time?:PlayerTime, seed?:number|null}} PlayerState */
/** @typedef {{id:number|string, pirateThreat?:number, jumpGates?:Array<number|string>}} SiteState */
/** @typedef {{sectorId?:number|string, stock?:CargoStock, maxStock?:CargoStock, basePrices?:Record<string,number>}} PortState */
/** @typedef {{sectorId?:number|string, owner?:string|null, stock?:CargoStock, factionId?:string|null}} PlanetState */
/** @typedef {{id:number|string, originSector:number, destinationSector:number, status?:string, ownerType?:string, ownerId?:number|string|null}} TradeRouteRecord */
/** @typedef {{id:number|string, known?:boolean, status?:string, currentSector?:number, character?:object|null}} CaptainRecord */
/** @typedef {{id:number|string, type?:string, text:string, day?:number, minute?:number}} WorldEventRecord */
/** @typedef {{id:number|string, eventType?:string, sourceSystem?:string, timestamp?:{day:number, minuteOfDay:number}}} SimulationTraceRecord */
/** @typedef {{version?:number, profilesBySector?:Record<string,object>, pressureBySector?:Record<string,object>, recentVolumeBySector?:Record<string,object>, contracts?:Array<object>, nextContractId?:number, dailySummary?:object|null, lastProfileBuildDay?:number|null, lastPressureDay?:number|null, generatedByVersion?:number, universeBasePrices?:Record<string,number>, priceDiagnostics?:Record<string,object>, nodeMidPrices?:Record<string,Record<string,number>>, spatialPriceDiagnostics?:Record<string,Record<string,object>>, lastPriceCalibrationDay?:number|null, lastSpatialPriceDay?:number|null}} EconomyState */
/** @typedef {{version?:number, player?:PlayerState|null, universe?:Record<string,SiteState>, ports?:Record<string,PortState>, planets?:Record<string,PlanetState>, economy?:EconomyState}} SavePayload */
/** @typedef {{type:string, args?:unknown[]}} CommandPayload */
/** @typedef {{ok:boolean, slices:StateSliceName[], invalidateAll:boolean, message:string|null, noop?:boolean}} CommandResult */
/** @typedef {{changed:boolean, slices:StateSliceName[]}} StatePatchResult */
/** @typedef {{player: PlayerState|null, universe: Record<string, SiteState>, sitesById?:Record<string,SiteState>, ports: Record<string, PortState>, planets: Record<string, PlanetState>, tradeRoutes: TradeRouteRecord[], captains: Record<string, CaptainRecord>, worldEvents: WorldEventRecord[], simulationTrace: SimulationTraceRecord[], economy: EconomyState, dataCargo: object, ambientTrade: object, currentScreen?:string, selectedSectorId?:number|null, mapViewport?:{scale:number, offsetX:number, offsetY:number}, mapLayers?:Record<string,boolean>, appMode?:string, selectedDialogueConversationId?:number|string|null, dialogueConversations?:Array<object>}} AppState */

export {};
