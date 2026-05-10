import { escapeHtml } from '../utils.js';

const STORAGE_KEY = 'star-trading.ledger.v1';
const MIN_ROWS = 20;
const MAX_ROWS = 500;
const MIN_COLS = 8;
const MAX_COLS = 26;
const DEFAULT_COL_WIDTH = 96;
const MIN_COL_WIDTH = 48;
const MAX_COL_WIDTH = 360;
const DEFAULT_ROW_HEIGHT = 28;
const MIN_ROW_HEIGHT = 22;
const MAX_ROW_HEIGHT = 120;
const MAX_FUNCTION_RESOLUTION_DEPTH = 40;
const DECIMAL_PRECISION = 4;
const MAX_RANGE_CELLS = 5000;
const MAX_CELL_CHARS = 500;

let rowCount = 30;
let colCount = 10;
let selectedKey = 'A1';
let rawData = {};
let colWidths = {};
let rowHeights = {};
let lastStatus = 'Offline ledger ready';
let computing = new Set();

const SUPPORTED_FUNCTIONS = new Set(['SUM', 'AVERAGE', 'AVG', 'MIN', 'MAX', 'COUNT', 'PRODUCT']);

function colToLetter(index) {
    let n = index + 1;
    let label = '';
    while (n > 0) {
        const remainder = (n - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        n = Math.floor((n - 1) / 26);
    }
    return label;
}

function letterToCol(label) {
    return String(label || '').toUpperCase().split('').reduce((sum, ch) => {
        const value = ch.charCodeAt(0) - 64;
        return value >= 1 && value <= 26 ? sum * 26 + value : sum;
    }, 0) - 1;
}

function cellKey(row, col) {
    return `${colToLetter(col)}${row}`;
}

function parseCellKey(key) {
    const match = String(key || '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const col = letterToCol(match[1]);
    const row = Number(match[2]);
    if (!Number.isInteger(row) || row < 1 || col < 0 || col >= MAX_COLS) return null;
    return { key: `${colToLetter(col)}${row}`, row, col };
}

function normalizeKey(key) {
    const parsed = parseCellKey(key);
    return parsed ? parsed.key : 'A1';
}

function getRaw(key) {
    return rawData[normalizeKey(key)] || '';
}

function clampInteger(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getColumnWidth(col) {
    return clampInteger(colWidths[col], MIN_COL_WIDTH, MAX_COL_WIDTH, DEFAULT_COL_WIDTH);
}

function getRowHeight(row) {
    return clampInteger(rowHeights[row], MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, DEFAULT_ROW_HEIGHT);
}

function setColumnWidth(col, width) {
    if (!Number.isInteger(col) || col < 0 || col >= MAX_COLS) return;
    colWidths[col] = clampInteger(width, MIN_COL_WIDTH, MAX_COL_WIDTH, DEFAULT_COL_WIDTH);
}

function setRowHeight(row, height) {
    if (!Number.isInteger(row) || row < 1 || row > MAX_ROWS) return;
    rowHeights[row] = clampInteger(height, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, DEFAULT_ROW_HEIGHT);
}

function setRaw(key, value) {
    const normalized = normalizeKey(key);
    const raw = String(value ?? '').slice(0, MAX_CELL_CHARS);
    if (raw) rawData[normalized] = raw;
    else delete rawData[normalized];
}

function ensureSelectionBounds() {
    const parsed = parseCellKey(selectedKey);
    if (!parsed || parsed.row > rowCount || parsed.col >= colCount) selectedKey = 'A1';
}

function tokenizeExpression(source) {
    const tokens = [];
    let i = 0;
    let expectValue = true;
    while (i < source.length) {
        const ch = source[i];
        if (/\s/.test(ch)) {
            i += 1;
            continue;
        }
        if ((ch === '-' || ch === '+') && expectValue) {
            const numberMatch = source.slice(i + 1).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
            if (numberMatch) {
                tokens.push(ch === '-' ? `-${numberMatch[0]}` : numberMatch[0]);
                i += numberMatch[0].length + 1;
                expectValue = false;
                continue;
            }
            if (ch === '-') {
                // Normalize unary negation before grouped values, e.g. -(A1), into binary math.
                tokens.push('0');
                tokens.push('-');
            } else {
                // Unary plus is a no-op, e.g. +(A1), so we intentionally skip emitting a token.
            }
            i += 1;
            expectValue = true;
            continue;
        }
        if (/[+\-*/%()]/.test(ch)) {
            tokens.push(ch);
            i += 1;
            expectValue = ch !== ')';
            continue;
        }
        const numberMatch = source.slice(i).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
        if (numberMatch) {
            tokens.push(numberMatch[0]);
            i += numberMatch[0].length;
            expectValue = false;
            continue;
        }
        return null;
    }
    return tokens;
}

function evaluateMathTokens(tokens) {
    if (tokens == null) return '#ERROR';
    if (tokens.length === 0) return 0;
    const output = [];
    const ops = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };
    const isOperator = token => Object.prototype.hasOwnProperty.call(precedence, token);

    tokens.forEach(token => {
        if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) {
            output.push(Number(token));
            return;
        }
        if (token === '(') {
            ops.push(token);
            return;
        }
        if (token === ')') {
            while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop());
            if (!ops.length) {
                output.push('#ERROR');
                return;
            }
            ops.pop();
            return;
        }
        if (isOperator(token)) {
            while (ops.length && isOperator(ops[ops.length - 1]) && precedence[ops[ops.length - 1]] >= precedence[token]) {
                output.push(ops.pop());
            }
            ops.push(token);
            return;
        }
        output.push('#ERROR');
    });

    while (ops.length) {
        const op = ops.pop();
        if (op === '(' || op === ')') return '#ERROR';
        output.push(op);
    }

    const stack = [];
    for (const token of output) {
        if (token === '#ERROR') return '#ERROR';
        if (typeof token === 'number') {
            stack.push(token);
            continue;
        }
        const right = stack.pop();
        const left = stack.pop();
        if (!Number.isFinite(left) || !Number.isFinite(right)) return '#ERROR';
        if (token === '+') stack.push(left + right);
        else if (token === '-') stack.push(left - right);
        else if (token === '*') stack.push(left * right);
        else if (token === '/') {
            if (right === 0) return '#ERROR';
            stack.push(left / right);
        } else if (token === '%') {
            if (right === 0) return '#ERROR';
            stack.push(left % right);
        }
    }
    return stack.length === 1 && Number.isFinite(stack[0]) ? stack[0] : '#ERROR';
}

function splitFunctionArgs(source) {
    const args = [];
    let depth = 0;
    let current = '';
    String(source || '').split('').forEach(ch => {
        if (ch === '(') depth += 1;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
            return;
        }
        current += ch;
    });
    if (current.trim()) args.push(current.trim());
    return args;
}

function parseRange(token) {
    const match = String(token || '').trim().match(/^([A-Z]+\d+)\s*:\s*([A-Z]+\d+)$/i);
    if (!match) return null;
    const start = parseCellKey(match[1]);
    const end = parseCellKey(match[2]);
    if (!start || !end) return null;
    const rowStart = Math.min(start.row, end.row);
    const rowEnd = Math.max(start.row, end.row);
    const colStart = Math.min(start.col, end.col);
    const colEnd = Math.max(start.col, end.col);
    const cellCount = (rowEnd - rowStart + 1) * (colEnd - colStart + 1);
    if (cellCount > MAX_RANGE_CELLS) return null;
    const cells = [];
    for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
            cells.push(cellKey(row, col));
        }
    }
    return cells;
}

function evaluateFunction(name, argStr, currentKey) {
    const values = [];
    const args = splitFunctionArgs(argStr);
    for (const arg of args) {
        const range = parseRange(arg);
        if (range) {
            for (const ref of range) {
                const value = evaluateCellReference(ref, currentKey);
                if (typeof value === 'string' && value.startsWith('#')) return value;
                if (typeof value === 'number' && Number.isFinite(value)) values.push(value);
            }
            continue;
        }
        const value = evaluateFormulaBody(arg, currentKey);
        if (typeof value === 'string' && value.startsWith('#')) return value;
        if (typeof value === 'number' && Number.isFinite(value)) values.push(value);
    }
    const upper = name.toUpperCase();
    if (upper === 'COUNT') return values.length;
    if (upper === 'SUM') return values.reduce((sum, value) => sum + value, 0);
    if (upper === 'PRODUCT') return values.length ? values.reduce((acc, value) => acc * value, 1) : 0;
    if (values.length === 0) return 0;
    if (upper === 'AVERAGE' || upper === 'AVG') return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (upper === 'MIN') return Math.min(...values);
    if (upper === 'MAX') return Math.max(...values);
    return '#ERROR';
}

function resolveFunctions(source, currentKey) {
    let result = source;
    const callRegex = /\b([A-Z][A-Z0-9_]*)\s*\(([^()]*)\)/i;
    for (let i = 0; i < MAX_FUNCTION_RESOLUTION_DEPTH; i++) {
        const match = result.match(callRegex);
        if (!match) return result;
        const name = match[1].toUpperCase();
        if (!SUPPORTED_FUNCTIONS.has(name)) return '#ERROR';
        const value = evaluateFunction(name, match[2], currentKey);
        if (typeof value === 'string' && value.startsWith('#')) return value;
        result = result.slice(0, match.index) + String(value) + result.slice((match.index || 0) + match[0].length);
    }
    return '#ERROR';
}

function evaluateCellReference(key, currentKey) {
    const parsed = parseCellKey(key);
    if (!parsed) return 0;
    if (parsed.key === currentKey) return '#CYCLE';
    const value = getComputed(parsed.key);
    if (typeof value === 'string' && value.startsWith('#')) return value;
    return typeof value === 'number' ? value : 0;
}

function evaluateFormulaBody(source, currentKey) {
    const resolved = resolveFunctions(source, currentKey);
    if (typeof resolved === 'string' && resolved.startsWith('#')) return resolved;
    const withRefs = String(resolved).replace(/\b([A-Z]+\d+)\b/gi, match => {
        const value = evaluateCellReference(match, currentKey);
        return String(value);
    });
    if (withRefs.includes('#')) return withRefs.includes('#CYCLE') ? '#CYCLE' : '#ERROR';
    const tokens = tokenizeExpression(withRefs);
    return evaluateMathTokens(tokens);
}

function getComputed(key) {
    const normalized = normalizeKey(key);
    if (computing.has(normalized)) return '#CYCLE';
    const raw = getRaw(normalized);
    const trimmed = raw.trim();
    if (!trimmed.startsWith('=')) {
        if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return Number(trimmed);
        return raw;
    }
    computing.add(normalized);
    try {
        return evaluateFormulaBody(trimmed.slice(1), normalized);
    } finally {
        computing.delete(normalized);
    }
}

function formatComputed(value) {
    if (typeof value !== 'number') return value || '';
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toFixed(DECIMAL_PRECISION)));
}

function renderCell(row, col) {
    const key = cellKey(row, col);
    const raw = getRaw(key);
    const value = getComputed(key);
    const classes = ['ledger-cell'];
    if (key === selectedKey) classes.push('selected');
    if (raw.trim().startsWith('=')) classes.push('has-formula');
    if (typeof value === 'number') classes.push('numeric');
    if (typeof value === 'string' && value.startsWith('#')) classes.push('cell-error');
    return `<td class="${classes.join(' ')}" data-cell="${key}" title="${escapeHtml(raw)}" style="height:${getRowHeight(row)}px">${escapeHtml(formatComputed(value))}</td>`;
}

function renderGrid() {
    computing.clear();
    let html = '<table class="ledger-table"><colgroup>';
    html += '<col style="width:48px">';
    for (let col = 0; col < colCount; col++) {
        html += `<col style="width:${getColumnWidth(col)}px">`;
    }
    html += '</colgroup><thead><tr><th class="ledger-corner"></th>';
    for (let col = 0; col < colCount; col++) {
        html += `<th class="ledger-col-header" data-col="${col}">${colToLetter(col)}<span class="ledger-col-resizer" data-ledger-resize="col" data-col="${col}"></span></th>`;
    }
    html += '</tr></thead><tbody>';
    for (let row = 1; row <= rowCount; row++) {
        html += `<tr style="height:${getRowHeight(row)}px"><th class="ledger-row-header" data-row="${row}">${row}<span class="ledger-row-resizer" data-ledger-resize="row" data-row="${row}"></span></th>`;
        for (let col = 0; col < colCount; col++) html += renderCell(row, col);
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

function currentCellSummary() {
    const raw = getRaw(selectedKey);
    const value = getComputed(selectedKey);
    const valueLabel = formatComputed(value) || 'empty';
    return raw ? `Raw: ${escapeHtml(raw)} / Value: ${escapeHtml(valueLabel)}` : 'empty cell';
}

function sanitizeRawData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const safe = {};
    for (const [key, raw] of Object.entries(value)) {
        const parsed = parseCellKey(key);
        if (!parsed) continue;
        if (parsed.row > MAX_ROWS || parsed.col >= MAX_COLS) continue;
        safe[parsed.key] = String(raw ?? '').slice(0, MAX_CELL_CHARS);
    }
    return safe;
}

function sanitizeDimensionMap(value, min, max, fallback, keyMin, keyMax) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const safe = {};
    for (const [key, size] of Object.entries(value)) {
        const index = Number(key);
        if (!Number.isInteger(index) || index < keyMin || index > keyMax) continue;
        safe[index] = clampInteger(size, min, max, fallback);
    }
    return safe;
}

function persistDraft(showStatus = true) {
    try {
        const storage = globalThis.localStorage;
        if (!storage) return;
        storage.setItem(STORAGE_KEY, JSON.stringify({
            rowCount,
            colCount,
            selectedKey,
            rawData,
            colWidths,
            rowHeights
        }));
        if (showStatus) lastStatus = 'Draft saved';
    } catch (_err) {
        if (showStatus) lastStatus = 'Draft save failed';
    }
}

function loadDraft() {
    try {
        const storage = globalThis.localStorage;
        const payload = storage ? storage.getItem(STORAGE_KEY) : null;
        if (!payload) {
            lastStatus = 'No saved draft found';
            rerenderLedger();
            return;
        }
        const parsed = JSON.parse(payload);
        rawData = sanitizeRawData(parsed.rawData);
        rowCount = clampInteger(parsed.rowCount, MIN_ROWS, MAX_ROWS, rowCount);
        colCount = clampInteger(parsed.colCount, MIN_COLS, MAX_COLS, colCount);
        colWidths = sanitizeDimensionMap(parsed.colWidths, MIN_COL_WIDTH, MAX_COL_WIDTH, DEFAULT_COL_WIDTH, 0, MAX_COLS - 1);
        rowHeights = sanitizeDimensionMap(parsed.rowHeights, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, DEFAULT_ROW_HEIGHT, 1, MAX_ROWS);
        selectedKey = normalizeKey(parsed.selectedKey || 'A1');
        lastStatus = 'Draft loaded';
    } catch (_err) {
        lastStatus = 'Draft load failed';
    }
    rerenderLedger();
}

function selectCell(key, shouldFocus = true) {
    selectedKey = normalizeKey(key);
    const parsed = parseCellKey(selectedKey);
    if (parsed) {
        selectedKey = cellKey(Math.min(parsed.row, MAX_ROWS), parsed.col);
        rowCount = Math.max(rowCount, Math.min(parsed.row, MAX_ROWS));
        colCount = Math.max(colCount, Math.min(parsed.col + 1, MAX_COLS));
    }
    document.querySelectorAll('.ledger-cell.selected').forEach(cell => cell.classList.remove('selected'));
    const selected = document.querySelector(`[data-cell="${selectedKey}"]`);
    if (selected) selected.classList.add('selected');
    const address = document.getElementById('ledgerAddress');
    const formula = document.getElementById('ledgerFormula');
    const status = document.getElementById('ledgerStatus');
    if (address) address.textContent = selectedKey;
    if (formula) formula.value = getRaw(selectedKey);
    if (status) status.innerHTML = `${escapeHtml(lastStatus)} / ${currentCellSummary()}`;
    if (shouldFocus) document.getElementById('ledgerSheet')?.focus({ preventScroll: true });
}

function rerenderLedger(shouldFocus = true) {
    const root = document.getElementById('ledgerSheet');
    if (!root) return;
    root.outerHTML = renderSpreadsheetScreen();
    bindSpreadsheetScreen(shouldFocus);
}

function handleResizePointerDown(event) {
    const handle = event.target.closest('[data-ledger-resize]');
    if (!handle) return;

    event.preventDefault();
    event.stopPropagation();

    const resizeType = handle.dataset.ledgerResize;
    const startX = event.clientX;
    const startY = event.clientY;
    const col = Number(handle.dataset.col);
    const row = Number(handle.dataset.row);
    const startWidth = Number.isInteger(col) ? getColumnWidth(col) : DEFAULT_COL_WIDTH;
    const startHeight = Number.isInteger(row) ? getRowHeight(row) : DEFAULT_ROW_HEIGHT;

    const doc = globalThis.document;
    if (!doc) return;

    if (resizeType === 'row') doc.body.classList.add('ledger-resizing-row');
    else doc.body.classList.add('ledger-resizing');

    const onMove = moveEvent => {
        if (resizeType === 'col' && Number.isInteger(col)) {
            setColumnWidth(col, startWidth + moveEvent.clientX - startX);
        } else if (resizeType === 'row' && Number.isInteger(row)) {
            setRowHeight(row, startHeight + moveEvent.clientY - startY);
        }
        rerenderLedger(false);
    };

    const onUp = () => {
        doc.body.classList.remove('ledger-resizing');
        doc.body.classList.remove('ledger-resizing-row');
        doc.removeEventListener('pointermove', onMove);
        doc.removeEventListener('pointerup', onUp);
        persistDraft(false);
    };

    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
}

function commitFormula() {
    const formula = document.getElementById('ledgerFormula');
    if (!formula) return;
    setRaw(selectedKey, formula.value);
    lastStatus = `Committed ${selectedKey}`;
    persistDraft(false);
    rerenderLedger();
}

function moveSelection(deltaRow, deltaCol) {
    const parsed = parseCellKey(selectedKey) || { row: 1, col: 0 };
    const row = Math.max(1, Math.min(rowCount, parsed.row + deltaRow));
    const col = Math.max(0, Math.min(colCount - 1, parsed.col + deltaCol));
    selectCell(cellKey(row, col));
}

function clearSelection() {
    setRaw(selectedKey, '');
    lastStatus = `Cleared ${selectedKey}`;
    persistDraft(false);
    rerenderLedger();
}

function addRow() {
    if (rowCount >= MAX_ROWS) {
        lastStatus = 'Row limit reached';
        rerenderLedger();
        return;
    }
    rowCount += 1;
    lastStatus = `Added row ${rowCount}`;
    persistDraft(false);
    rerenderLedger();
}

function addColumn() {
    if (colCount >= MAX_COLS) {
        lastStatus = 'Column limit reached';
        rerenderLedger();
        return;
    }
    colCount += 1;
    lastStatus = `Added column ${colToLetter(colCount - 1)}`;
    persistDraft(false);
    rerenderLedger();
}

function clearSheet() {
    if (typeof globalThis.confirm !== 'function') {
        lastStatus = 'Clear unavailable in this environment';
        rerenderLedger();
        return;
    }
    const confirmFn = globalThis.confirm;
    if (!confirmFn('Clear the entire ledger?')) return;
    rawData = {};
    rowCount = 30;
    colCount = 10;
    colWidths = {};
    rowHeights = {};
    selectedKey = 'A1';
    lastStatus = 'Ledger cleared';
    persistDraft(false);
    rerenderLedger();
}

function loadDemo() {
    rawData = {};
    [['A1', 'Frontier Trade Run'], ['B1', 'Ore'], ['C1', 'Organics'], ['D1', 'Equipment'], ['E1', 'Fuel'], ['F1', 'Total'],
        ['A2', 'S12 Buy'], ['B2', '180'], ['C2', '72'], ['D2', '420'], ['E2', '35'], ['F2', '=SUM(B2:E2)'],
        ['A3', 'S18 Sell'], ['B3', '240'], ['C3', '110'], ['D3', '520'], ['E3', '40'], ['F3', '=SUM(B3:E3)'],
        ['A4', 'Margin'], ['B4', '=B3-B2'], ['C4', '=C3-C2'], ['D4', '=D3-D2'], ['E4', '=E3-E2'], ['F4', '=SUM(B4:E4)']]
        .forEach(([key, value]) => setRaw(key, value));
    selectedKey = 'A1';
    lastStatus = 'Demo trade ledger loaded';
    persistDraft(false);
    rerenderLedger();
}

function handleToolbarAction(action) {
    if (action === 'commit') commitFormula();
    else if (action === 'demo') loadDemo();
    else if (action === 'add-row') addRow();
    else if (action === 'add-column') addColumn();
    else if (action === 'save') {
        persistDraft(true);
        rerenderLedger();
    } else if (action === 'load') loadDraft();
    else if (action === 'clear') clearSheet();
}

function handleLedgerKeydown(event) {
    const tagName = event.target?.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1, 0);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1, 0);
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelection(0, -1);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelection(0, 1);
    } else if (event.key === 'Tab') {
        event.preventDefault();
        moveSelection(0, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        clearSelection();
    }
}

export function renderSpreadsheetScreen() {
    ensureSelectionBounds();
    const raw = getRaw(selectedKey);
    return `<div id="ledgerSheet" class="ledger-screen" tabindex="0">`
        + '<div class="comms-grid">'
        + '<div class="comms-panel ledger-toolbar-panel">'
        + '<h4>Trade Ledger</h4>'
        + '<div class="small muted">Standalone spreadsheet tool for route and cargo planning.</div>'
        + '<div class="ledger-toolbar compact-actions">'
        + '<button type="button" data-ledger-action="demo">Demo Data</button>'
        + '<button type="button" data-ledger-action="add-row">Add Row</button>'
        + '<button type="button" data-ledger-action="add-column">Add Column</button>'
        + '<button type="button" data-ledger-action="save">Save Draft</button>'
        + '<button type="button" data-ledger-action="load">Load Draft</button>'
        + '<button type="button" data-ledger-action="clear">Clear</button>'
        + '</div>'
        + '<div class="small muted">Formulas: SUM, AVERAGE/AVG, MIN, MAX, COUNT, PRODUCT. Example: =SUM(A1:A10)</div>'
        + '</div>'
        + '<div class="comms-panel ledger-formula-panel">'
        + `<div id="ledgerAddress" class="ledger-address">${escapeHtml(selectedKey)}</div>`
        + '<label class="ledger-formula-label"><span>fx</span>'
        + `<input id="ledgerFormula" type="text" value="${escapeHtml(raw)}" autocomplete="off" spellcheck="false" placeholder="Type value or formula starting with =">`
        + '</label>'
        + '<button type="button" data-ledger-action="commit">Commit</button>'
        + `<div id="ledgerStatus" class="ledger-status small muted">${escapeHtml(lastStatus)} / ${currentCellSummary()}</div>`
        + '</div>'
        + '<div class="comms-panel ledger-grid-panel">'
        + `<div class="ledger-grid-scroll">${renderGrid()}</div>`
        + '</div>'
        + '</div>'
        + '</div>';
}

export function bindSpreadsheetScreen(shouldFocus = false) {
    const root = document.getElementById('ledgerSheet');
    if (!root) return;
    root.addEventListener('pointerdown', handleResizePointerDown);
    root.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-ledger-action]');
        if (actionButton) {
            handleToolbarAction(actionButton.dataset.ledgerAction);
            return;
        }
        const cell = event.target.closest('[data-cell]');
        if (cell) selectCell(cell.dataset.cell);
    });
    root.addEventListener('dblclick', event => {
        const cell = event.target.closest('[data-cell]');
        if (!cell) return;
        selectedKey = normalizeKey(cell.dataset.cell);
        const formula = document.getElementById('ledgerFormula');
        if (formula) {
            formula.focus();
            formula.select();
        }
    });
    root.addEventListener('keydown', handleLedgerKeydown);
    const formula = document.getElementById('ledgerFormula');
    formula?.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commitFormula();
    });
    if (shouldFocus) root.focus({ preventScroll: true });
}
