import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateSpreadsheetCells } from '../js/ui/renderSpreadsheet.js';

describe('spreadsheet formula evaluator', () => {
    it('evaluates SUM ranges', () => {
        const values = evaluateSpreadsheetCells({
            A1: '1',
            A2: '2',
            A3: '3',
            B1: '=SUM(A1:A3)'
        });

        assert.equal(values.B1, 6);
    });

    it('evaluates AVERAGE ranges', () => {
        const values = evaluateSpreadsheetCells({
            A1: '2',
            A2: '4',
            A3: '6',
            B1: '=AVERAGE(A1:A3)'
        });

        assert.equal(values.B1, 4);
    });

    it('evaluates cell division expressions', () => {
        const values = evaluateSpreadsheetCells({
            A1: '10',
            B1: '2',
            C1: '=A1/B1'
        });

        assert.equal(values.C1, 5);
    });

    it('detects formula cycles', () => {
        const values = evaluateSpreadsheetCells({
            A1: '=B1',
            B1: '=A1'
        });

        assert.equal(values.A1, '#CYCLE');
        assert.equal(values.B1, '#CYCLE');
    });

    it('reports division by zero as an error', () => {
        const values = evaluateSpreadsheetCells({
            A1: '10',
            B1: '0',
            C1: '=A1/B1'
        });

        assert.equal(values.C1, '#ERROR');
    });

    it('reports malformed functions as an error', () => {
        const values = evaluateSpreadsheetCells({
            A1: '1',
            B1: '=MEDIAN(A1:A3)'
        });

        assert.equal(values.B1, '#ERROR');
    });

    it('rejects ranges larger than the range cap', () => {
        const values = evaluateSpreadsheetCells({
            A1: '1',
            B1: '=SUM(A1:Z500)'
        });

        assert.equal(values.B1, '#ERROR');
    });
});
