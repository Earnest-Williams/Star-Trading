import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

const APPROVED_STATE_IMPORTERS = Object.freeze([
    'js/app/gameSessionController.js',
    'js/utils.js',
    'js/main.js',
    'js/core/dataCargo/implementation.js',
    'js/core/factions.js',
    'js/core/influence.js',
    'js/core/intel.js',
    'js/core/navigation.js',
    'js/core/persistence.js',
    'js/core/priorityBriefingActions.js',
    'js/core/routePlanner.js',
    'js/core/simulationTrace.js',
    'js/core/state/mutations.js',
    'js/core/state/selectors.js',
    'js/core/time.js',
    'js/core/universe/implementation.js',
    'js/core/worldEvents.js',
    'js/core/worldTick.js',
    'js/systems/bounties.js',
    'js/systems/captains/implementation.js',
    'js/systems/colonies.js',
    'js/systems/combat.js',
    'js/systems/companies.js',
    'js/systems/contraband.js',
    'js/systems/economy/ambientFlows.js',
    'js/systems/economy/companyScoring.js',
    'js/systems/economy/consumption.js',
    'js/systems/economy/contracts.js',
    'js/systems/economy/initialPrices.js',
    'js/systems/economy/marketIntelligence.js',
    'js/systems/economy/nodeAdapter.js',
    'js/systems/economy/pressure.js',
    'js/systems/economy/pricing.js',
    'js/systems/economy/production.js',
    'js/systems/economy/profiles.js',
    'js/systems/economy/pulseService.js',
    'js/systems/economy/spatialPrices.js',
    'js/systems/entanglements/implementation.js',
    'js/systems/guilds.js',
    'js/systems/logisticsObjectives.js',
    'js/systems/market.js',
    'js/systems/marketTrade.js',
    'js/systems/mining.js',
    'js/systems/missions.js',
    'js/systems/people.js',
    'js/systems/people/contactServiceResolution.js',
    'js/systems/people/conversationParts.js',
    'js/systems/people/conversationQueries.js',
    'js/systems/people/conversations.js',
    'js/systems/people/dialogue.js',
    'js/systems/people/dialogueEvents.js',
    'js/systems/people/dialogueMaintenance.js',
    'js/systems/people/dialogueRealization.js',
    'js/systems/people/dialogueTasks.js',
    'js/systems/people/locateItemResolution.js',
    'js/systems/people/memory.js',
    'js/systems/people/messages.js',
    'js/systems/people/offers.js',
    'js/systems/people/proposals.js',
    'js/systems/people/relationshipConversationActions.js',
    'js/systems/people/relationships.js',
    'js/systems/politics.js',
    'js/systems/polities.js',
    'js/systems/properties.js',
    'js/systems/secureCourier.js',
    'js/systems/tradeRoutes/implementation.js',
    'js/systems/travel.js',
    'js/ui/economyFocus.js',
    'js/ui/onboarding.js',
    'js/ui/renderCaptains.js',
    'js/ui/renderCharacterSheet.js',
    'js/ui/renderColony.js',
    'js/ui/renderComms.js',
    'js/ui/renderHUD.js',
    'js/ui/renderLogistics.js',
    'js/ui/ui.js',
    'js/ui/renderMap.js',
    'js/ui/renderMarket.js',
    'js/ui/renderMissions.js',
    'js/ui/renderProperty.js',
    'js/ui/renderReputation.js',
    'js/ui/renderSector.js',
    'js/ui/renderShipyard.js',
    'js/ui/renderer.js',
    'js/ui/shellController.js'
]);

function listTrackedJsFiles() {
    const output = execFileSync('git', ['ls-files', 'js/*.js', 'js/**/*.js'], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
    });
    return output.trim().split('\n').filter(Boolean);
}

function importsLiveStateModule(source) {
    return /from\s+['"](?:\.\.?\/)*(?:js\/)?state\.js['"]/.test(source);
}

describe('state module import guard', () => {
    it('keeps js/state.js importers pinned to an explicit migration allowlist', () => {
        const offenders = [];
        const files = listTrackedJsFiles();

        files.forEach(file => {
            const filePath = `${REPO_ROOT}${file}`;
            if (!existsSync(filePath)) return;
            const source = readFileSync(filePath, 'utf8');
            if (importsLiveStateModule(source)) {
                offenders.push(file);
            }
        });

        assert.deepEqual(
            offenders.sort(),
            [...APPROVED_STATE_IMPORTERS].sort(),
            'Unexpected js/state.js importer set changed. Migrate through js/core/state before adding new importers.'
        );
    });
});
