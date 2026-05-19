export function htmlEscape(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function attrEscape(value) { return htmlEscape(value).replace(/`/g, '&#96;'); }
export function renderText(value) { return htmlEscape(value); }
export function renderNumber(value) { return Number.isFinite(Number(value)) ? String(Number(value)) : '0'; }
export function renderEnum(value, allowed = []) { return allowed.includes(value) ? String(value) : ''; }
export function renderButtonAction(action) { return attrEscape(action); }
export function renderDataAttr(name, value) { return `data-${attrEscape(name)}="${attrEscape(value)}"`; }
export function joinHtml(parts) { return parts.filter(Boolean).join(''); }

export const escapeHtml = htmlEscape;
