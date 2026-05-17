import { SKILL_NODES } from '../config/skillTrees.js';

export function getKnownSkillNodes(character) {
    const ids = Array.isArray(character?.skillNodeIds)
        ? character.skillNodeIds
        : Array.isArray(character?.skills)
            ? character.skills
            : [];
    return ids.map(nodeId => SKILL_NODES[nodeId]).filter(Boolean);
}

export function hasSkillNode(character, nodeId) {
    return getKnownSkillNodes(character).some(node => node.id === nodeId);
}

export function getSkillEffect(character, effectKey) {
    return getKnownSkillNodes(character).reduce((sum, node) => {
        const value = node.effects?.[effectKey];
        return sum + (typeof value === "number" ? value : 0);
    }, 0);
}

export function describeActiveSkillEffects(character) {
    const totals = new Map();
    getKnownSkillNodes(character).forEach(node => {
        Object.entries(node.effects || {}).forEach(([key, value]) => {
            if (typeof value === "number") totals.set(key, (totals.get(key) || 0) + value);
        });
    });
    return [...totals.entries()].map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`);
}
