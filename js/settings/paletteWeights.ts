/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { showToast } from '../ui.ts';

export function renderPaletteWeights() {
    const tbody = document.getElementById('palette-weights-table-body');
    tbody.innerHTML = '';
    appState.suroviny.filter(s => !s.isMix).forEach(surovina => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${surovina.name}</td>
            <td><input type="number" value="${surovina.paletteWeight || 500}" data-surovina-id="${surovina.id}" class="palette-weight-input" style="width: 120px;"></td>
            <td><input type="number" value="${surovina.boxWeight || 25}" data-surovina-id="${surovina.id}" class="box-weight-input" style="width: 120px;"></td>
        `;
        tbody.appendChild(tr);
    });
}

export function saveAllPaletteWeights() {
    document.querySelectorAll('.palette-weight-input').forEach(input => {
        const surovina = appState.suroviny.find(s => s.id === input.dataset.surovinaId);
        if (surovina) surovina.paletteWeight = parseFloat(input.value) || 0;
    });
    document.querySelectorAll('.box-weight-input').forEach(input => {
        const surovina = appState.suroviny.find(s => s.id === input.dataset.surovinaId);
        if (surovina) surovina.boxWeight = parseFloat(input.value) || 0;
    });
    saveState();
    showToast('Váhy palet a beden uloženy');
}