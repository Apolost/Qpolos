/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

export function generateId() { return crypto.randomUUID(); }

export function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

export function getDateOfWeek(w, y) {
    const d = (1 + (w - 1) * 7); // 1st day of the week
    return new Date(y, 0, d);
}

export function minutesToTimeString(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.round(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}