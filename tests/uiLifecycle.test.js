import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state, APP_MODES } from '../js/state.js';
import { initUI, disposeUI } from '../js/ui/ui.js';
import { executeAction } from '../js/core/commands.js';

function makeClassList() {
    const classes = new Set();
    return {
        add(name) { classes.add(name); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        toggle(name, force) {
            if (force === true) classes.add(name);
            else if (force === false) classes.delete(name);
            else if (classes.has(name)) classes.delete(name);
            else classes.add(name);
        },
        contains(name) { return classes.has(name); }
    };
}

function createFakeElement({ id = null, className = '' } = {}) {
    const listeners = new Map();
    const element = {
        id,
        className,
        hidden: false,
        dataset: {},
        textContent: '',
        parentElement: null,
        classList: makeClassList(),
        children: [],
        setAttribute() {},
        addEventListener(type, fn) {
            const list = listeners.get(type) || [];
            list.push(fn);
            listeners.set(type, list);
        },
        removeEventListener(type, fn) {
            const list = listeners.get(type) || [];
            listeners.set(type, list.filter(listener => listener !== fn));
        },
        appendChild(child) {
            child.parentElement = element;
            element.children.push(child);
        },
        remove() {
            if (!element.parentElement) return;
            element.parentElement.children = element.parentElement.children.filter(child => child !== element);
            element.parentElement = null;
        },
        querySelector(selector) {
            if (selector === '.screen-rail-toggle') {
                return element.children.find(child => child.className === 'screen-rail-toggle') || null;
            }
            return null;
        },
        click() {
            const list = listeners.get('click') || [];
            list.forEach(listener => listener({ target: element, preventDefault() {}, stopPropagation() {} }));
        }
    };
    return element;
}

function createFakeDocument() {
    const gameShell = createFakeElement({ id: 'gameShell' });
    const controls = createFakeElement({ id: 'screenPanelControls' });
    const summary = createFakeElement({ id: 'screenSummary' });
    const actions = createFakeElement({ id: 'actions' });
    const left = createFakeElement({ id: 'btn-toggle-left-sidebar' });
    const right = createFakeElement({ id: 'btn-toggle-right-sidebar' });
    const viewport = createFakeElement({ className: 'main-viewport' });
    const panel = createFakeElement({ className: 'screen-content-panel' });
    const railModeButton = createFakeElement();
    railModeButton.dataset.screenPanelMode = 'rail';
    railModeButton.closest = selector => (selector === '[data-screen-panel-mode]' ? railModeButton : null);
    controls.closest = () => null;

    const byId = new Map([
        ['gameShell', gameShell],
        ['screenPanelControls', controls],
        ['screenSummary', summary],
        ['actions', actions],
        ['btn-toggle-left-sidebar', left],
        ['btn-toggle-right-sidebar', right]
    ]);

    const docListeners = new Map();
    const document = {
        body: createFakeElement(),
        getElementById(id) { return byId.get(id) || null; },
        querySelector(selector) {
            if (selector === '.screen-content-panel') return panel;
            if (selector === '.main-viewport') return viewport;
            return null;
        },
        querySelectorAll(selector) {
            if (selector !== '.screen-rail-toggle') return [];
            return panel.children.filter(child => child.className === 'screen-rail-toggle');
        },
        createElement() { return createFakeElement(); },
        addEventListener(type, fn) {
            const list = docListeners.get(type) || [];
            list.push(fn);
            docListeners.set(type, list);
        },
        removeEventListener(type, fn) {
            const list = docListeners.get(type) || [];
            docListeners.set(type, list.filter(listener => listener !== fn));
        }
    };
    document.body.dataset = {};

    controls.clickRail = () => {
        const event = {
            target: { closest: selector => (selector === '[data-screen-panel-mode]' ? railModeButton : null) }
        };
        const list = (controls.__listeners?.click || []);
        list.forEach(fn => fn(event));
    };

    const originalAdd = controls.addEventListener;
    controls.__listeners = {};
    controls.addEventListener = (type, fn) => {
        controls.__listeners[type] = controls.__listeners[type] || [];
        controls.__listeners[type].push(fn);
        originalAdd(type, fn);
    };

    return { document, panel, controls };
}

describe('ui lifecycle invariants', () => {
    it('keeps one rail toggle across dispose/init and binds one mode handler', () => {
        const originalDocument = globalThis.document;
        const fixture = createFakeDocument();
        globalThis.document = fixture.document;

        resetState();
        state.appMode = APP_MODES.IN_GAME;
        state.player = { currentSector: 1 };
        state.screenPanelMode = 'full';

        initUI();
        disposeUI();
        initUI();
        initUI();

        const railButtons = fixture.document.querySelectorAll('.screen-rail-toggle');
        assert.equal(railButtons.length, 1);

        fixture.controls.clickRail();
        assert.equal(state.screenPanelMode, 'rail');

        const toggleResult = executeAction({ type: 'toggleMapInspectorCompact', args: [] });
        assert.equal(toggleResult.ok, true);

        disposeUI();

        const afterDisposeResult = executeAction({ type: 'toggleMapInspectorCompact', args: [] });
        assert.equal(afterDisposeResult.ok, false);
        globalThis.document = originalDocument;
    });
});
