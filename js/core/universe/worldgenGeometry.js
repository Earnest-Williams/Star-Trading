import { WORLDGEN_GEOMETRY } from '../../config/worldgen.js';

const SITE_TYPE_LABELS = {
    stellar_system: "Stellar System",
    brown_dwarf_system: "Brown Dwarf System",
    rogue_system: "Rogue System",
    way_station: "Way Station",
    white_dwarf_remnant: "White Dwarf Remnant",
    circumbinary_system: "Circumbinary System",
    multiple_star_system: "Multiple Star System",
    exotic_remnant: "Exotic Remnant"
};

const RICHNESS_LABELS = {
    barren: "Barren",
    sparse: "Sparse",
    developing: "Developing",
    settled: "Settled",
    hub: "Hub",
    strategic: "Strategic"
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function coordKey(coord) {
    return `${coord.x},${coord.y},${coord.z}`;
}

export function distanceBetweenCoords(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function getSiteTypeLabel(siteType) {
    return SITE_TYPE_LABELS[siteType] || siteType || "Unknown Site";
}

export function getRichnessLabel(richness) {
    return RICHNESS_LABELS[richness] || richness || "Unrated";
}

export function metricShearAtCoord(coord) {
    const shear = WORLDGEN_GEOMETRY.SHEAR;
    const planarDistance = Math.sqrt(coord.x * coord.x + coord.y * coord.y);
    const centralNoise = Math.max(0, (shear.CENTRAL_RADIUS - planarDistance) / shear.CENTRAL_RADIUS)
        * shear.CENTRAL_MULTIPLIER;
    const offPlaneRelief = Math.min(shear.OFF_PLANE_RELIEF_MAX, Math.abs(coord.z) * shear.OFF_PLANE_RELIEF_MULTIPLIER);
    const lumpyNoise = (Math.sin(coord.x * shear.LUMPY_X_FREQUENCY)
        + Math.cos(coord.y * shear.LUMPY_Y_FREQUENCY)
        + Math.sin(coord.z * shear.LUMPY_Z_FREQUENCY)) * shear.LUMPY_MULTIPLIER;
    return clamp(shear.BASELINE + centralNoise + lumpyNoise - offPlaneRelief, shear.MIN, shear.MAX);
}

export function generateClusterCenters(archetype, count, rng) {
    if (archetype.armCount === 0) {
        let previous = { x: 0, y: 0, z: 0 };
        return Array.from({ length: count }, (_, index) => {
            const newClump = index === 0 || rng() < 0.28;
            if (newClump) {
                previous = {
                    x: Math.round(WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_X_MIN
                        + rng() * WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_X_SPAN
                        + index * WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_X_INDEX_DRIFT),
                    y: Math.round(WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_Y_MIN
                        + rng() * WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_Y_SPAN),
                    z: Math.round((rng() - 0.5) * archetype.zScale)
                };
            } else {
                previous = {
                    x: Math.round(previous.x + (rng() - 0.35) * (archetype.chainDrift || 2)),
                    y: Math.round(previous.y + (rng() - 0.5) * (archetype.chainDrift || 2)),
                    z: Math.round(previous.z + (rng() - 0.5) * archetype.zScale)
                };
            }
            return previous;
        });
    }
    return Array.from({ length: count }, (_, index) => {
        if (archetype.barLength && index < Math.max(6, Math.floor(count * 0.18))) {
            const t = (index / Math.max(1, Math.floor(count * 0.18) - 1)) * 2 - 1;
            return {
                x: Math.round(t * archetype.barLength + (rng() - 0.5) * 3),
                y: Math.round((rng() - 0.5) * 6),
                z: Math.round((rng() - 0.5) * archetype.zScale)
            };
        }
        const arm = index % archetype.armCount;
        const spacing = archetype.armSpacing || WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_RADIUS_STEP;
        const radiusBase = archetype.ringRadius && index < Math.floor(count * 0.28)
            ? archetype.ringRadius : WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_RADIUS_BASE;
        const radius = radiusBase + index * spacing + rng() * WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_RADIUS_JITTER;
        const curve = archetype.armTwist || WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_ANGLE_CURVE;
        const satelliteOffset = archetype.satelliteEvery && index % archetype.satelliteEvery === 0 ? 8 + rng() * 10 : 0;
        const angle = arm * (Math.PI * 2 / archetype.armCount) + radius * curve;
        return {
            x: Math.round(Math.cos(angle) * (radius + satelliteOffset)),
            y: Math.round(Math.sin(angle) * (radius + satelliteOffset)),
            z: Math.round((rng() - 0.5) * archetype.zScale)
        };
    });
}

export function generateSiteCoordinate(archetype, centers, index, rng) {
    const center = centers[index % centers.length];
    for (let attempt = 0; attempt < WORLDGEN_GEOMETRY.SITE_PLACEMENT.MAX_ATTEMPTS; attempt++) {
        const scale = index < WORLDGEN_GEOMETRY.SITE_PLACEMENT.EARLY_SITE_LIMIT
            ? WORLDGEN_GEOMETRY.SITE_PLACEMENT.EARLY_SCALE
            : index < WORLDGEN_GEOMETRY.SITE_PLACEMENT.MID_SITE_LIMIT
                ? WORLDGEN_GEOMETRY.SITE_PLACEMENT.MID_SCALE : WORLDGEN_GEOMETRY.SITE_PLACEMENT.LATE_SCALE;
        const coord = {
            x: Math.round(center.x + (rng() - 0.5) * archetype.clusterJitter * scale),
            y: Math.round(center.y + (rng() - 0.5) * archetype.clusterJitter * scale),
            z: Math.round(center.z + (rng() - 0.5) * archetype.zScale * 2)
        };
        if (metricShearAtCoord(coord) < WORLDGEN_GEOMETRY.SITE_PLACEMENT.ACCEPTABLE_SHEAR) return coord;
    }
    return { x: center.x + index * WORLDGEN_GEOMETRY.SITE_PLACEMENT.FALLBACK_X_OFFSET_PER_INDEX, y: center.y, z: center.z };
}
