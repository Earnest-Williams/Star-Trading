import assert from 'node:assert/strict';

export function assertInRange(value, min, max, label) {
    assert.ok(
        value >= min && value <= max,
        `${label}=${value} out of range ${min}–${max}`
    );
}

export function assertPositive(value, label) {
    assert.ok(value > 0, `${label} should be positive; got ${value}`);
}
