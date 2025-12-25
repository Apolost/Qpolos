
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showToast } from '../ui.ts';

export function renderBoxWeights() {
    const accordion = document.getElementById('box-weights-accordion');
    if (!accordion) return;
    accordion.innerHTML = '';
    
    const customersToRender = appState.zakaznici.filter(c => c.name.toLowerCase() !== 'kfc');

    const spizyProducts = [
        { id: 'spizy_klobasa', name: 'Špíz Klobása' },
        { id: 'spizy_spek', name: 'Špíz Špek' },
        { id: 'spizy_cilli', name: 'Špíz Čilli Mango' },
    ];

    const trayOptions = appState.trayTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    customersToRender.forEach(customer => {
        const details = document.createElement('details');
        details.innerHTML = `
            <summary>${customer.name}<i data-feather="chevron-right" class="arrow-icon"></i></summary>
            <div class="details-content accordion nested-accordion">
                <!-- Sekce budou vloženy dynamicky -->
            </div>
        `;
        const content = details.querySelector('.details-content');

        // Helper pro generování tabulky pro konkrétní typ balení
        const createTableForType = (type, label, unit = 'kg', step = '0.01') => {
            const hasTrays = type === 'OA' || type === 'RB';
            let html = `
                <details>
                    <summary>${label} <i data-feather="chevron-right" class="arrow-icon"></i></summary>
                    <div class="details-content">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Produkt</th>
                                    ${hasTrays ? `<th style="width: 100px; color: var(--text-secondary);">Váha misky (g)</th>` : ''}
                                    <th style="width: 120px;">Váha bedny (${unit})</th>
                                    ${hasTrays ? `<th style="width: 180px;">Typ misky</th><th style="width: 100px;">Misek v bedně</th>` : ''}
                                    <th class="actions">Aktivní</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            const surovinyForCustomer = appState.suroviny
                .filter(s => s.isActive && !s.name.includes('Špíz'))
                .map(s => ({...s, status: appState.boxWeights[customer.id]?.[s.id]?.isActive ?? true }));
            
            surovinyForCustomer.sort((a, b) => b.status - a.status);

            surovinyForCustomer.forEach(surovina => {
                const weights = appState.boxWeights[customer.id]?.[surovina.id] || { OA: 4000, RB: 4000, VL: 10000, isActive: true, oaTraysPerBox: 8, rbTraysPerBox: 4 };
                const inactiveClass = !weights.isActive ? 'class="product-inactive"' : '';
                const activeIcon = weights.isActive ? ICONS.eye : ICONS.eyeOff;
                
                let weightVal;
                if (type === 'OA') weightVal = (weights.OA / 1000).toFixed(2);
                else if (type === 'RB') weightVal = (weights.RB / 1000).toFixed(2);
                else weightVal = weights.VL;

                // Tray Assignment
                const trayId = appState.customerTrayAssignments[customer.id]?.[surovina.id] || appState.trayTypes[0]?.id;
                const trayCount = type === 'OA' ? (weights.oaTraysPerBox || 8) : (weights.rbTraysPerBox || 4);

                // Calculate initial tray weight for display
                let trayWeightDisplay = '';
                if (hasTrays) {
                    const w = parseFloat(weightVal) || 0;
                    const c = parseInt(trayCount) || 1;
                    if (c > 0) trayWeightDisplay = Math.round((w * 1000) / c);
                }

                html += `
                    <tr ${inactiveClass}>
                        <td>${surovina.name}</td>
                        ${hasTrays ? `
                            <td>
                                <input type="text" disabled value="${trayWeightDisplay}" class="tray-weight-display" style="width: 80px; background-color: #f3f4f6; color: #6b7280;">
                            </td>
                        ` : ''}
                        <td>
                            <input type="number" step="${step}" value="${weightVal}" 
                                   data-customer-id="${customer.id}" data-surovina-id="${surovina.id}" 
                                   data-order-type="${type}" class="box-weight-input calc-trigger">
                        </td>
                        ${hasTrays ? `
                            <td>
                                <select class="box-weight-tray-select" data-customer-id="${customer.id}" data-surovina-id="${surovina.id}">
                                    ${trayOptions}
                                </select>
                            </td>
                            <td>
                                <input type="number" value="${trayCount}" 
                                       data-customer-id="${customer.id}" data-surovina-id="${surovina.id}" 
                                       data-order-type="${type}" class="box-weight-tray-count calc-trigger">
                            </td>
                        ` : ''}
                        <td class="actions">
                            <button class="btn-icon" data-action="toggle-box-weight-product-active" 
                                    data-customer-id="${customer.id}" data-surovina-id="${surovina.id}">
                                ${activeIcon}
                            </button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table></div></details>`;
            return html;
        };

        // Přidání sekcí OA, RB, VL
        let sectionsHTML = '';
        sectionsHTML += createTableForType('OA', 'Malé misky (OA)', 'kg', '0.01');
        sectionsHTML += createTableForType('RB', 'Rodinné balení (RB)', 'kg', '0.01');
        sectionsHTML += createTableForType('VL', 'Volně ložené (VL)', 'g', '1');

        // Přidání sekce Špízy
        sectionsHTML += `
            <details>
                <summary>Špízy <i data-feather="chevron-right" class="arrow-icon"></i></summary>
                <div class="details-content">
                    <table class="data-table">
                        <thead><tr><th>Produkt</th><th style="width: 150px;">Váha (g)</th></tr></thead>
                        <tbody>
        `;
        spizyProducts.forEach(prod => {
            const weights = appState.boxWeights[customer.id]?.[prod.id] || { VL: 10000 };
            sectionsHTML += `
                <tr>
                    <td>${prod.name}</td>
                    <td>
                        <input type="number" value="${weights.VL}" 
                               data-customer-id="${customer.id}" data-surovina-id="${prod.id}" 
                               data-order-type="VL" class="box-weight-input">
                    </td>
                </tr>
            `;
        });
        sectionsHTML += `</tbody></table></div></details>`;

        content.innerHTML = sectionsHTML;
        
        // Nastavení hodnot selectů po vložení HTML
        content.querySelectorAll('.box-weight-tray-select').forEach(select => {
            const { customerId, surovinaId } = select.dataset;
            const trayId = appState.customerTrayAssignments[customerId]?.[surovinaId] || appState.trayTypes[0]?.id;
            select.value = trayId;
        });

        // Add Event Listeners for live calculation
        content.querySelectorAll('.calc-trigger').forEach(input => {
            input.addEventListener('input', (e) => {
                const row = e.target.closest('tr');
                const weightInput = row.querySelector('.box-weight-input');
                const countInput = row.querySelector('.box-weight-tray-count');
                const display = row.querySelector('.tray-weight-display');

                if (weightInput && countInput && display) {
                    const weight = parseFloat(weightInput.value) || 0;
                    const count = parseInt(countInput.value) || 1;
                    if (count > 0) {
                        display.value = Math.round((weight * 1000) / count);
                    } else {
                        display.value = '-';
                    }
                }
            });
        });

        accordion.appendChild(details);
    });
    feather.replace();
}

export function saveAllBoxWeights() {
    // 1. Save weights and tray counts
    document.querySelectorAll('.box-weight-input').forEach(input => {
        const { customerId, surovinaId, orderType } = input.dataset;
        if (!appState.boxWeights[customerId]) appState.boxWeights[customerId] = {};
        if (!appState.boxWeights[customerId][surovinaId]) appState.boxWeights[customerId][surovinaId] = { OA: 4000, RB: 4000, VL: 10000, isActive: true, oaTraysPerBox: 8, rbTraysPerBox: 4 };
        
        let weightInGrams;
        if (orderType === 'OA' || orderType === 'RB') {
            weightInGrams = Math.round((parseFloat(input.value) || 0) * 1000);
        } else {
            weightInGrams = parseInt(input.value) || 0;
        }
        appState.boxWeights[customerId][surovinaId][orderType] = weightInGrams;
    });

    document.querySelectorAll('.box-weight-tray-count').forEach(input => {
        const { customerId, surovinaId, orderType } = input.dataset;
        const count = parseInt(input.value) || 0;
        const key = orderType === 'OA' ? 'oaTraysPerBox' : 'rbTraysPerBox';
        appState.boxWeights[customerId][surovinaId][key] = count;
    });

    // 2. Save tray assignments
    document.querySelectorAll('.box-weight-tray-select').forEach(select => {
        const { customerId, surovinaId } = select.dataset;
        if (!appState.customerTrayAssignments[customerId]) appState.customerTrayAssignments[customerId] = {};
        appState.customerTrayAssignments[customerId][surovinaId] = select.value;
    });

    saveState();
    showToast('Nastavení balení a vah uloženo');
    renderBoxWeights();
}

export function toggleBoxWeightProductActive(customerId, surovinaId) {
    const productWeights = appState.boxWeights[customerId]?.[surovinaId];
    if (productWeights) {
        productWeights.isActive = !productWeights.isActive;
        saveState();
        renderBoxWeights();
    }
}
