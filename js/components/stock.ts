
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast, showConfirmation } from '../ui.ts';
import { generateId } from '../utils.ts';

// --- BOXES ---

// Function to render the list of box types in the settings modal
function renderBoxTypesTable() {
    const tbody = document.getElementById('box-types-table-body');
    if (!tbody) return;

    tbody.innerHTML = appState.boxTypes.map(bt => `
        <tr>
            <td>${bt.name}</td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-box-type" data-id="${bt.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-box-type" data-id="${bt.id}">${ICONS.trash}</button>
            </td>
        </tr>
    `).join('');
    feather.replace();
}

// Function to render the assignments accordion in the settings modal
function renderBoxAssignmentsAccordion() {
    const accordion = document.getElementById('box-assignments-accordion');
    if (!accordion) return;

    const boxTypeOptions = appState.boxTypes.map(bt => `<option value="${bt.id}">${bt.name}</option>`).join('');
    
    const allOrderableItems = appState.suroviny
        .filter(s => s.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));
    
    accordion.innerHTML = appState.zakaznici.map(customer => {
        let itemRows = allOrderableItems.map(item => {
            return `
                <tr>
                    <td>${item.name}</td>
                    <td>
                        <select class="box-assignment-select" data-customer-id="${customer.id}" data-surovina-id="${item.id}">
                            ${boxTypeOptions}
                        </select>
                    </td>
                </tr>
            `;
        }).join('');

        if (allOrderableItems.length === 0) {
            itemRows = `<tr><td colspan="2">Nejsou definovány žádné produkty ani suroviny.</td></tr>`;
        }

        return `
            <details>
                <summary>${customer.name}<i data-feather="chevron-right" class="arrow-icon"></i></summary>
                <div class="details-content">
                    <table class="data-table">
                        <thead><tr><th>Produkt / Surovina</th><th>Typ bedny</th></tr></thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>
            </details>
        `;
    }).join('');

    // After generating HTML, set the selected value for each select dropdown
    accordion.querySelectorAll('.box-assignment-select').forEach(select => {
        const { customerId, surovinaId } = select.dataset;
        const defaultBoxTypeId = appState.boxTypes.find(bt => bt.name === 'Karton malý')?.id || 'bt02';
        const assignedBoxTypeId = appState.customerBoxAssignments[customerId]?.[surovinaId] || defaultBoxTypeId;
        select.value = assignedBoxTypeId;
    });

    feather.replace();
}


// Function to reset the box type form
export function handleCancelEditBoxType() {
    appState.ui.editingBoxTypeId = null;
    const modal = DOMElements.boxSettingsModal;
    modal.querySelector('#box-type-id').value = '';
    modal.querySelector('#box-type-name').value = '';
    const saveBtn = modal.querySelector('#save-box-type-btn');
    saveBtn.innerHTML = `<i data-feather="plus"></i> Přidat bednu`;
    modal.querySelector('#cancel-edit-box-type-btn').style.display = 'none';
    feather.replace();
}

// The main function to open the settings modal
export function openBoxSettingsModal() {
    const modal = DOMElements.boxSettingsModal;
    if (!modal) {
        console.error("Box settings modal not found!");
        return;
    }
    renderBoxTypesTable();
    renderBoxAssignmentsAccordion();
    handleCancelEditBoxType(); // Reset form
    modal.classList.add('active');
}

// Handlers for box type management
export function handleSaveBoxType() {
    const modal = DOMElements.boxSettingsModal;
    const id = modal.querySelector('#box-type-id').value;
    const nameInput = modal.querySelector('#box-type-name');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('Název bedny nesmí být prázdný.', 'error', 'settings');
        return;
    }
    
    const isDuplicate = appState.boxTypes.some(bt => bt.name.toLowerCase() === name.toLowerCase() && bt.id !== id);
    if (isDuplicate) {
        showToast('Bedna s tímto názvem již existuje.', 'error', 'settings');
        return;
    }

    if (id) { // Editing
        const boxType = appState.boxTypes.find(bt => bt.id === id);
        if (boxType) {
            boxType.name = name;
            showToast('Typ bedny upraven.', 'success', 'settings');
        }
    } else { // Adding
        const newBoxType = { id: `bt${Date.now()}`, name };
        appState.boxTypes.push(newBoxType);
        showToast('Nový typ bedny přidán.', 'success', 'settings');
    }

    saveState();
    renderBoxTypesTable();
    renderBoxAssignmentsAccordion(); // Re-render to include new box type in options
    handleCancelEditBoxType();
}

export function handleEditBoxType(id) {
    const boxType = appState.boxTypes.find(bt => bt.id === id);
    if (!boxType) return;

    appState.ui.editingBoxTypeId = id;
    const modal = DOMElements.boxSettingsModal;
    modal.querySelector('#box-type-id').value = id;
    modal.querySelector('#box-type-name').value = boxType.name;
    
    const saveBtn = modal.querySelector('#save-box-type-btn');
    saveBtn.innerHTML = `<i data-feather="save"></i> Uložit změny`;
    modal.querySelector('#cancel-edit-box-type-btn').style.display = 'inline-block';
    
    feather.replace();
    modal.querySelector('#box-type-name').focus();
}

export function handleDeleteBoxType(id) {
    // Check if the box type is in use
    const isInUse = Object.values(appState.customerBoxAssignments).some(customerAssignments =>
        Object.values(customerAssignments).some(boxTypeId => boxTypeId === id)
    );
    
    if (isInUse) {
        showToast('Tento typ bedny nelze smazat, protože je přiřazen k produktům.', 'error', 'settings');
        return;
    }

    showConfirmation('Opravdu chcete smazat tento typ bedny?', () => {
        appState.boxTypes = appState.boxTypes.filter(bt => bt.id !== id);
        saveState();
        showToast('Typ bedny smazán.', 'success', 'settings');
        renderBoxTypesTable();
        renderBoxAssignmentsAccordion();
    });
}

// Handler for saving assignments
export function handleSaveBoxAssignments() {
    const modal = DOMElements.boxSettingsModal;
    modal.querySelectorAll('.box-assignment-select').forEach(select => {
        const { customerId, surovinaId } = select.dataset;
        if (!appState.customerBoxAssignments[customerId]) {
            appState.customerBoxAssignments[customerId] = {};
        }
        appState.customerBoxAssignments[customerId][surovinaId] = select.value;
    });
    
    saveState();
    showToast('Přiřazení beden uloženo.', 'success', 'settings');
    renderStockBoxes(); // Re-render the main view in case it's visible behind
}


export function renderStockBoxes() {
    const container = document.getElementById('stock-boxes-container');
    if (!container) return;

    const date = appState.ui.selectedDate;

    // 1. Display list of all defined box types as a collapsible section
    let listHtml = `
        <div class="accordion" style="margin-bottom: 24px;">
            <details>
                <summary>
                    Definované typy beden (${appState.boxTypes.length})
                    <i data-feather="chevron-right" class="arrow-icon"></i>
                </summary>
                <div class="details-content">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
    `;
    appState.boxTypes.forEach(bt => {
        listHtml += `<span style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 0.9rem; font-weight: 500; padding: 4px 12px; border-radius: 16px;">${bt.name}</span>`;
    });
    listHtml += `
                    </div>
                </div>
            </details>
        </div>
    `;


    // 2. Calculate needs for each box type using the new customerBoxAssignments
    const boxCounts = new Map(appState.boxTypes.map(bt => [bt.id, 0]));
    let totalBoxes = 0;
    
    const defaultBoxTypeId = appState.boxTypes.find(bt => bt.name === 'Karton malý')?.id || 'bt02';

    // Tally from standard orders
    appState.orders
        .filter(o => o.date === date)
        .forEach(order => {
            order.items.forEach(item => {
                if (item.isActive) {
                    const surovina = appState.suroviny.find(s => s.id === item.surovinaId);
                    if (surovina) { // Count boxes for any orderable item
                        const boxTypeId = appState.customerBoxAssignments[order.customerId]?.[item.surovinaId] || defaultBoxTypeId;
                        if (boxCounts.has(boxTypeId)) {
                            const count = item.boxCount || 0;
                            boxCounts.set(boxTypeId, boxCounts.get(boxTypeId) + count);
                            totalBoxes += count;
                        }
                    }
                }
            });
        });

    // Tally from planned actions
    appState.plannedActions
        .filter(a => {
            const dayCountData = a.dailyCounts?.[date];
            return dayCountData && dayCountData.boxCount > 0 && date >= a.startDate && (!a.endDate || date <= a.endDate);
        })
        .forEach(action => {
            const surovina = appState.suroviny.find(s => s.id === action.surovinaId);
            if (surovina) { // Count boxes for any planned item
                const boxTypeId = appState.customerBoxAssignments[action.customerId]?.[action.surovinaId] || defaultBoxTypeId;
                if (boxCounts.has(boxTypeId)) {
                    const count = action.dailyCounts[date].boxCount || 0;
                    boxCounts.set(boxTypeId, boxCounts.get(boxTypeId) + count);
                    totalBoxes += count;
                }
            }
        });

    // 3. Generate summary table HTML
    let tableHTML = `
        <h3 class="subsection-title">Souhrn potřebných beden na den</h3>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Typ bedny</th>
                    <th style="text-align: right;">Potřebný počet (ks)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let hasAnyNeeds = false;
    appState.boxTypes.forEach(boxType => {
        const count = boxCounts.get(boxType.id) || 0;
        if (count > 0) {
            hasAnyNeeds = true;
            tableHTML += `
                <tr>
                    <td>${boxType.name}</td>
                    <td style="text-align: right;">${count}</td>
                </tr>
            `;
        }
    });

    if (!hasAnyNeeds) {
        tableHTML += `<tr><td colspan="2" style="text-align: center;">Pro tento den neexistují žádné objednávky vyžadující definované bedny.</td></tr>`;
    }

    tableHTML += `
            </tbody>
            <tfoot>
                <tr style="font-weight: bold; background-color: var(--bg-tertiary);">
                    <td>Celkem</td>
                    <td style="text-align: right;">${totalBoxes}</td>
                </tr>
            </tfoot>
        </table>
    `;
    
    container.innerHTML = listHtml + tableHTML;
    feather.replace();
}

// --- TRAYS ---

function renderTrayTypesTable() {
    const tbody = document.getElementById('tray-types-table-body');
    if (!tbody) return;

    tbody.innerHTML = appState.trayTypes.map(tt => `
        <tr>
            <td>${tt.name}</td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-tray-type" data-id="${tt.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-tray-type" data-id="${tt.id}">${ICONS.trash}</button>
            </td>
        </tr>
    `).join('');
    feather.replace();
}

function renderTrayAssignmentsAccordion() {
    const accordion = document.getElementById('tray-assignments-accordion');
    if (!accordion) return;

    const trayTypeOptions = appState.trayTypes.map(tt => `<option value="${tt.id}">${tt.name}</option>`).join('');
    
    const allOrderableItems = appState.suroviny
        .filter(s => s.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));
    
    accordion.innerHTML = appState.zakaznici.map(customer => {
        let itemRows = allOrderableItems.map(item => {
            return `
                <tr>
                    <td>${item.name}</td>
                    <td>
                        <select class="tray-assignment-select" data-customer-id="${customer.id}" data-surovina-id="${item.id}">
                            ${trayTypeOptions}
                        </select>
                    </td>
                </tr>
            `;
        }).join('');

        if (allOrderableItems.length === 0) {
            itemRows = `<tr><td colspan="2">Nejsou definovány žádné produkty ani suroviny.</td></tr>`;
        }

        return `
            <details>
                <summary>${customer.name}<i data-feather="chevron-right" class="arrow-icon"></i></summary>
                <div class="details-content">
                    <table class="data-table">
                        <thead><tr><th>Produkt / Surovina</th><th>Typ misky</th></tr></thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>
            </details>
        `;
    }).join('');

    accordion.querySelectorAll('.tray-assignment-select').forEach(select => {
        const { customerId, surovinaId } = select.dataset;
        const defaultTrayTypeId = appState.trayTypes[0]?.id;
        const assignedTrayTypeId = appState.customerTrayAssignments[customerId]?.[surovinaId] || defaultTrayTypeId;
        select.value = assignedTrayTypeId;
    });

    feather.replace();
}

export function handleCancelEditTrayType() {
    appState.ui.editingTrayTypeId = null;
    const modal = DOMElements.traySettingsModal;
    modal.querySelector('#tray-type-id').value = '';
    modal.querySelector('#tray-type-name').value = '';
    const saveBtn = modal.querySelector('#save-tray-type-btn');
    saveBtn.innerHTML = `<i data-feather="plus"></i> Přidat misku`;
    modal.querySelector('#cancel-edit-tray-type-btn').style.display = 'none';
    feather.replace();
}

export function openTraySettingsModal() {
    const modal = DOMElements.traySettingsModal;
    if (!modal) {
        console.error("Tray settings modal not found!");
        return;
    }
    renderTrayTypesTable();
    renderTrayAssignmentsAccordion();
    handleCancelEditTrayType();
    modal.classList.add('active');
}

export function handleSaveTrayType() {
    const modal = DOMElements.traySettingsModal;
    const id = modal.querySelector('#tray-type-id').value;
    const nameInput = modal.querySelector('#tray-type-name');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('Název misky nesmí být prázdný.', 'error', 'settings');
        return;
    }
    
    if (appState.trayTypes.some(tt => tt.name.toLowerCase() === name.toLowerCase() && tt.id !== id)) {
        showToast('Miska s tímto názvem již existuje.', 'error', 'settings');
        return;
    }

    if (id) {
        const trayType = appState.trayTypes.find(tt => tt.id === id);
        if (trayType) trayType.name = name;
        showToast('Typ misky upraven.', 'success', 'settings');
    } else {
        appState.trayTypes.push({ id: `mt${Date.now()}`, name });
        showToast('Nový typ misky přidán.', 'success', 'settings');
    }

    saveState();
    renderTrayTypesTable();
    renderTrayAssignmentsAccordion();
    handleCancelEditTrayType();
}

export function handleEditTrayType(id) {
    const trayType = appState.trayTypes.find(tt => tt.id === id);
    if (!trayType) return;

    appState.ui.editingTrayTypeId = id;
    const modal = DOMElements.traySettingsModal;
    modal.querySelector('#tray-type-id').value = id;
    modal.querySelector('#tray-type-name').value = trayType.name;
    
    const saveBtn = modal.querySelector('#save-tray-type-btn');
    saveBtn.innerHTML = `<i data-feather="save"></i> Uložit změny`;
    modal.querySelector('#cancel-edit-tray-type-btn').style.display = 'inline-block';
    
    feather.replace();
    modal.querySelector('#tray-type-name').focus();
}

export function handleDeleteTrayType(id) {
    if (Object.values(appState.customerTrayAssignments).some(cust => Object.values(cust).some(trayId => trayId === id))) {
        showToast('Tento typ misky nelze smazat, protože je přiřazen k produktům.', 'error', 'settings');
        return;
    }

    showConfirmation('Opravdu chcete smazat tento typ misky?', () => {
        appState.trayTypes = appState.trayTypes.filter(tt => tt.id !== id);
        saveState();
        showToast('Typ misky smazán.', 'success', 'settings');
        renderTrayTypesTable();
        renderTrayAssignmentsAccordion();
    });
}

export function handleSaveTrayAssignments() {
    const modal = DOMElements.traySettingsModal;
    modal.querySelectorAll('.tray-assignment-select').forEach(select => {
        const { customerId, surovinaId } = select.dataset;
        if (!appState.customerTrayAssignments[customerId]) {
            appState.customerTrayAssignments[customerId] = {};
        }
        appState.customerTrayAssignments[customerId][surovinaId] = select.value;
    });
    
    saveState();
    showToast('Přiřazení misek uloženo.', 'success', 'settings');
    renderStockTrays();
}

export function renderStockTrays() {
    const container = document.getElementById('stock-trays-container');
    if (!container) return;

    const date = appState.ui.selectedDate;

    // 1. Display list of all defined tray types
    let listHtml = `
        <div class="accordion" style="margin-bottom: 24px;">
            <details>
                <summary>
                    Definované typy misek (${appState.trayTypes.length})
                    <i data-feather="chevron-right" class="arrow-icon"></i>
                </summary>
                <div class="details-content">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
    `;
    appState.trayTypes.forEach(tt => {
        listHtml += `<span style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 0.9rem; font-weight: 500; padding: 4px 12px; border-radius: 16px;">${tt.name}</span>`;
    });
    listHtml += `</div></div></details></div>`;

    // 2. Calculate needs for each tray type
    const trayCounts = new Map(appState.trayTypes.map(tt => [tt.id, 0]));
    let totalTrays = 0;
    const defaultTrayTypeId = appState.trayTypes[0]?.id;

    appState.orders
        .filter(o => o.date === date)
        .forEach(order => {
            order.items.forEach(item => {
                if (item.isActive && (item.type === 'OA' || item.type === 'RB')) {
                    const trayTypeId = appState.customerTrayAssignments[order.customerId]?.[item.surovinaId] || defaultTrayTypeId;
                    if (trayCounts.has(trayTypeId)) {
                        const count = item.boxCount || 0;
                        trayCounts.set(trayTypeId, trayCounts.get(trayTypeId) + count);
                        totalTrays += count;
                    }
                }
            });
        });

    // 3. Generate summary table
    let tableHTML = `
        <h3 class="subsection-title">Souhrn potřebných misek na den</h3>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Typ misky</th>
                    <th style="text-align: right;">Potřebný počet (ks)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let hasAnyNeeds = false;
    appState.trayTypes.forEach(trayType => {
        const count = trayCounts.get(trayType.id) || 0;
        if (count > 0) {
            hasAnyNeeds = true;
            tableHTML += `
                <tr>
                    <td>${trayType.name}</td>
                    <td style="text-align: right;">${count}</td>
                </tr>
            `;
        }
    });

    if (!hasAnyNeeds) {
        tableHTML += `<tr><td colspan="2" style="text-align: center;">Pro tento den neexistují žádné objednávky v miskách (OA/RB).</td></tr>`;
    }

    tableHTML += `
            </tbody>
            <tfoot>
                <tr style="font-weight: bold; background-color: var(--bg-tertiary);">
                    <td>Celkem</td>
                    <td style="text-align: right;">${totalTrays}</td>
                </tr>
            </tfoot>
        </table>
    `;
    
    container.innerHTML = listHtml + tableHTML;
    feather.replace();
}

// --- TRAY STOCK ---

export function openTrayStockModal() {
    const modal = DOMElements.trayStockModal;
    const body = modal.querySelector('#tray-stock-modal-body');
    const date = appState.ui.selectedDate;

    // Calculate needs
    const trayCounts = new Map(appState.trayTypes.map(tt => [tt.id, 0]));
    const defaultTrayTypeId = appState.trayTypes[0]?.id;

    appState.orders
        .filter(o => o.date === date)
        .forEach(order => {
            order.items.forEach(item => {
                if (item.isActive && (item.type === 'OA' || item.type === 'RB')) {
                    const trayTypeId = appState.customerTrayAssignments[order.customerId]?.[item.surovinaId] || defaultTrayTypeId;
                    if (trayCounts.has(trayTypeId)) {
                        const count = item.boxCount || 0;
                        trayCounts.set(trayTypeId, trayCounts.get(trayTypeId) + count);
                    }
                }
            });
        });

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Typ misky</th>
                    <th style="text-align: right;">Potřeba dnes (ks)</th>
                    <th style="text-align: right;">Skladem (palety)</th>
                    <th style="text-align: right;">Skladem (ks)</th>
                    <th style="text-align: right;">Rozdíl (ks)</th>
                </tr>
            </thead>
            <tbody>
    `;

    appState.trayTypes.forEach(trayType => {
        const neededCount = trayCounts.get(trayType.id) || 0;
        const stockPallets = appState.trayStock[trayType.id] || 0;
        const piecesPerPallet = appState.trayPalletSettings[trayType.id] || 5000;
        const stockPieces = stockPallets * piecesPerPallet;
        const difference = stockPieces - neededCount;
        const diffClass = difference < 0 ? 'shortage' : 'surplus';

        tableHTML += `
            <tr>
                <td>${trayType.name}</td>
                <td style="text-align: right;">${neededCount.toLocaleString('cs-CZ')}</td>
                <td style="text-align: right; width: 150px;">
                    <input type="number" class="tray-stock-input" data-tray-id="${trayType.id}" value="${stockPallets}" min="0" style="width: 100px; text-align: right;">
                </td>
                <td style="text-align: right;">${stockPieces.toLocaleString('cs-CZ')}</td>
                <td class="${diffClass}" style="text-align: right; font-weight: bold;">${difference.toLocaleString('cs-CZ')}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;
    modal.classList.add('active');
}

export function saveTrayStock() {
    const modal = DOMElements.trayStockModal;
    let changes = 0;
    modal.querySelectorAll('.tray-stock-input').forEach(input => {
        const trayId = input.dataset.trayId;
        const pallets = parseFloat(input.value) || 0;
        if (appState.trayStock[trayId] !== pallets) {
            changes++;
            appState.trayStock[trayId] = pallets;
        }
    });

    if (changes > 0) {
        saveState();
        showToast('Stav skladu misek byl uložen.', 'success', 'stock');
    }
    
    modal.classList.remove('active');
}

export function openTrayPalletSettingsModal() {
    const modal = DOMElements.trayPalletSettingsModal;
    const typeSelect = modal.querySelector('#tray-pallet-settings-type');
    const countInput = modal.querySelector('#tray-pallet-settings-count');

    typeSelect.innerHTML = appState.trayTypes.map(tt => `<option value="${tt.id}">${tt.name}</option>`).join('');
    
    const updateCountInput = () => {
        const selectedId = typeSelect.value;
        countInput.value = appState.trayPalletSettings[selectedId] || 5000;
    };
    
    typeSelect.onchange = updateCountInput;

    updateCountInput(); // Initial population
    modal.classList.add('active');
}

export function saveTrayPalletSettings() {
    const modal = DOMElements.trayPalletSettingsModal;
    const typeId = modal.querySelector('#tray-pallet-settings-type').value;
    const count = parseInt(modal.querySelector('#tray-pallet-settings-count').value, 10);
    
    if (!typeId || isNaN(count) || count < 0) {
        showToast('Zadejte platné hodnoty.', 'error', 'settings');
        return;
    }

    appState.trayPalletSettings[typeId] = count;
    saveState();
    showToast('Nastavení palety uloženo.', 'success', 'settings');
    
    modal.classList.remove('active');
    
    // Re-render the stock modal if it's open
    if (DOMElements.trayStockModal.classList.contains('active')) {
        openTrayStockModal();
    }
}
