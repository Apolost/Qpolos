/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState } from '../state.ts';
import { getDailyNeeds, getMaykawaThighsNeeded, getKfcSurovinyNeeds, getSpizyNeeds } from '../services/calculations.ts';
import { showToast } from '../ui.ts';

function getComprehensiveDailyNeeds(date) {
    const allNeeds = {};

    // 1. Standard orders
    const standardNeeds = getDailyNeeds(date, 'non-kfc', true);
    for (const surovinaId in standardNeeds) {
        allNeeds[surovinaId] = (allNeeds[surovinaId] || 0) + standardNeeds[surovinaId];
    }
    
    // 2. Maykawa steak production needs
    const maykawaThighsNeeded = getMaykawaThighsNeeded(date);
    if (maykawaThighsNeeded > 0) {
        const thighsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
        if (thighsSurovina) {
            allNeeds[thighsSurovina.id] = (allNeeds[thighsSurovina.id] || 0) + maykawaThighsNeeded;
        }
    }

    // 3. KFC needs (convert from boxes to kg)
    const kfcSurovinyMap = new Map(appState.kfcSuroviny.map(s => [s.id, s]));
    const kfcNeedsInBoxes = getKfcSurovinyNeeds(date);
    for (const surovinaId in kfcNeedsInBoxes) {
        const kfcSurovina = kfcSurovinyMap.get(surovinaId);
        if (kfcSurovina) {
            const kg = kfcNeedsInBoxes[surovinaId] * (kfcSurovina.boxWeight / 1000);
            // This part is tricky as KFC ingredients are separate. We can't map them to the main suroviny list easily.
            // For now, we will list them separately. The request implies a unified list.
            // Let's create placeholder surovina names for the report.
            const placeholderName = `KFC ${kfcSurovina.name}`;
            allNeeds[placeholderName] = (allNeeds[placeholderName] || 0) + kg;
        }
    }

    // 4. Spizy needs
    const spizyNeeds = getSpizyNeeds(date);
    const spizySurovinyMap = {
        'klobasa': 'Klobasa (Spizy)',
        'spek': 'Spek (Spizy)',
        'steak': 'Steak (Spizy)',
        'cibule': 'Cibule (Spizy)',
        'paprika': 'Paprika (Spizy)',
        'rizky': appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY')?.id
    };
    for (const key in spizyNeeds) {
        if (spizyNeeds[key] > 0) {
            const surovinaIdOrName = spizySurovinyMap[key];
            if (surovinaIdOrName) {
                allNeeds[surovinaIdOrName] = (allNeeds[surovinaIdOrName] || 0) + spizyNeeds[key];
            }
        }
    }
    return allNeeds;
}

export function renderRawMaterialOrders() {
    const container = document.getElementById('raw-materials-results-container');
    if (!container) return;

    const date = appState.ui.selectedDate;
    const allNeeds = getComprehensiveDailyNeeds(date);

    if (Object.keys(allNeeds).length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Pro tento den není potřeba žádná surovina.</p>';
        return;
    }

    const surovinyMap = new Map(appState.suroviny.map(s => [s.id, s.name]));
    
    let tableHTML = `
        <table class="data-table">
            <thead><tr><th>Surovina</th><th>Celková potřeba (kg)</th></tr></thead>
            <tbody>
    `;

    const sortedNeeds = Object.entries(allNeeds).sort((a, b) => {
        const nameA = surovinyMap.get(a[0]) || a[0];
        const nameB = surovinyMap.get(b[0]) || b[0];
        return nameA.localeCompare(nameB);
    });

    for (const [surovinaIdOrName, totalKg] of sortedNeeds) {
        const name = surovinyMap.get(surovinaIdOrName) || surovinaIdOrName;
        tableHTML += `
            <tr>
                <td>${name}</td>
                <td><strong>${totalKg.toFixed(2)}</strong></td>
            </tr>
        `;
    }

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

export function exportRawMaterialOrdersToPdf() {
    const date = appState.ui.selectedDate;
    const allNeeds = getComprehensiveDailyNeeds(date);

    if (Object.keys(allNeeds).length === 0) {
        showToast('Není co exportovat.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const formattedDate = new Date(date).toLocaleDateString('cs-CZ');

    doc.setFontSize(18);
    doc.text(`Souhrn potreby surovin - ${formattedDate}`, 14, 22);

    const surovinyMap = new Map(appState.suroviny.map(s => [s.id, s.name]));
    const head = [['Surovina', 'Celkova potreba (kg)']];
    const sortedNeeds = Object.entries(allNeeds).sort((a, b) => {
        const nameA = surovinyMap.get(a[0]) || a[0];
        const nameB = surovinyMap.get(b[0]) || b[0];
        return nameA.localeCompare(nameB);
    });
    
    const body = sortedNeeds.map(([surovinaIdOrName, totalKg]) => {
        const name = surovinyMap.get(surovinaIdOrName) || surovinaIdOrName;
        return [name, totalKg.toFixed(2)];
    });

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        styles: { font: 'Helvetica' }
    });

    doc.save(`Potreba_surovin_${date}.pdf`);
    showToast('PDF se souhrnem potřebných surovin bylo vygenerováno.');
}