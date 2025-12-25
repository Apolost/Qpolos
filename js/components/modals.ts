
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast, showConfirmation } from '../ui.ts';
import { generateId } from '../utils.ts';
import { getDailyNeeds, getMaykawaThighsNeeded } from '../services/calculations.ts';

// --- Production Overview Modal ---
export function openProductionModal() {
    DOMElements.productionActionsModal.classList.add('active');
}

// --- Rizky Modal ---
export function openRizkyModal() {
    DOMElements.productionActionsModal.classList.remove('active');
    const modal = DOMElements.rizkyModal;
    const date = appState.ui.selectedDate;
    
    // Config
    const config = appState.rizkyConfig;
    document.getElementById('rizky-stock').value = config.stock;
    document.getElementById('rizky-prepad').value = config.prepad;
    document.getElementById('rizky-mastna').value = config.mastna;
    document.getElementById('rizky-line-performance').value = config.linePerformance;
    document.getElementById('rizky-start-time').value = config.startTime;
    document.getElementById('rizky-date').textContent = new Date(date).toLocaleDateString('cs-CZ');

    calculateRizky();
    
    // Bind change events for recalc
    ['rizky-stock', 'rizky-prepad', 'rizky-mastna', 'rizky-line-performance', 'rizky-start-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.onchange = () => {
                appState.rizkyConfig = {
                    stock: parseFloat(document.getElementById('rizky-stock').value) || 0,
                    prepad: parseFloat(document.getElementById('rizky-prepad').value) || 0,
                    mastna: parseFloat(document.getElementById('rizky-mastna').value) || 0,
                    linePerformance: parseFloat(document.getElementById('rizky-line-performance').value) || 0,
                    startTime: document.getElementById('rizky-start-time').value
                };
                saveState();
                calculateRizky();
            };
        }
    });

    modal.classList.add('active');
}

function calculateRizky() {
    const date = appState.ui.selectedDate;
    const needs = getDailyNeeds(date);
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    const neededKg = rizkySurovina ? (needs[rizkySurovina.id] || 0) : 0;
    
    const totalOrdersEl = document.getElementById('rizky-total-orders');
    if (totalOrdersEl) totalOrdersEl.textContent = neededKg.toFixed(2);
    
    const { stock, prepad, mastna, linePerformance, startTime } = appState.rizkyConfig;
    const totalProductionNeeded = Math.max(0, neededKg - stock + prepad + mastna);
    
    const totalNeededEl = document.getElementById('rizky-total-needed');
    if (totalNeededEl) totalNeededEl.textContent = totalProductionNeeded.toFixed(2);
    
    const runtimeEl = document.getElementById('rizky-runtime');
    const endTimeEl = document.getElementById('rizky-end-time');

    if (linePerformance > 0) {
        const hours = totalProductionNeeded / linePerformance;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        if (runtimeEl) runtimeEl.textContent = `${h} hod ${m} min`;
        
        const [startH, startM] = startTime.split(':').map(Number);
        const endDate = new Date();
        endDate.setHours(startH, startM, 0, 0);
        endDate.setMinutes(endDate.getMinutes() + (hours * 60));
        if (endTimeEl) endTimeEl.textContent = endDate.toLocaleTimeString('cs-CZ', {hour: '2-digit', minute:'2-digit'});
    } else {
        if (runtimeEl) runtimeEl.textContent = '---';
        if (endTimeEl) endTimeEl.textContent = '---';
    }
}

export function openRizkyAddOrderModal() {
    DOMElements.rizkyAddOrderModal.classList.add('active');
    renderRizkyAddOrderTable();
}

function renderRizkyAddOrderTable() {
    const container = document.getElementById('rizky-add-order-modal-body');
    const date = appState.ui.selectedDate;
    document.getElementById('rizky-add-order-date').textContent = new Date(date).toLocaleDateString('cs-CZ');
    
    let html = `<table class="data-table"><thead><tr><th>Zákazník</th><th>Typ</th><th>Počet beden</th></tr></thead><tbody>`;
    
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    if (!rizkySurovina) return;

    appState.zakaznici.forEach(customer => {
        ['OA', 'RB', 'VL'].forEach(type => {
            const weights = appState.boxWeights[customer.id]?.[rizkySurovina.id];
            // Only show active types
            if (weights && weights.isActive && weights[type] > 0) {
                 html += `
                    <tr>
                        <td>${customer.name}</td>
                        <td>${type}</td>
                        <td><input type="number" class="rizky-order-input" data-customer-id="${customer.id}" data-type="${type}" min="0"></td>
                    </tr>
                 `;
            }
        });
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

export function saveRizkyOrders() {
    const inputs = document.querySelectorAll('.rizky-order-input');
    const date = appState.ui.selectedDate;
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    
    let added = false;
    inputs.forEach(input => {
        const val = parseInt(input.value);
        if (val > 0) {
            const { customerId, type } = input.dataset;
            let order = appState.orders.find(o => o.customerId === customerId && o.date === date);
            if (!order) {
                order = { id: generateId(), date, customerId, items: [] };
                appState.orders.push(order);
            }
            const item = order.items.find(i => i.surovinaId === rizkySurovina.id && i.type === type);
            if (item) {
                item.boxCount += val;
            } else {
                order.items.push({ id: generateId(), surovinaId: rizkySurovina.id, type, boxCount: val, isActive: true, doneCount: 0 });
            }
            added = true;
        }
    });
    
    if (added) {
        saveState();
        showToast('Objednávky řízků uloženy.');
        calculateRizky();
    }
    DOMElements.rizkyAddOrderModal.classList.remove('active');
}

export function openRizkyOrderListModal() {
    DOMElements.rizkyOrderListModal.classList.add('active');
    renderRizkyOrderList();
}

function renderRizkyOrderList() {
    const tbody = document.querySelector('#rizky-order-list-table tbody');
    tbody.innerHTML = '';
    const date = appState.ui.selectedDate;
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    
    let totalBoxes = 0;
    let totalKg = 0;

    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.filter(i => i.surovinaId === rizkySurovina?.id && i.isActive).forEach(item => {
            const customer = appState.zakaznici.find(c => c.id === order.customerId);
            const weightConfig = appState.boxWeights[customer.id]?.[rizkySurovina.id];
            const weight = (weightConfig && weightConfig[item.type]) ? weightConfig[item.type] : 10000;
            const kg = item.boxCount * (weight / 1000);
            
            totalBoxes += item.boxCount;
            totalKg += kg;

            tbody.innerHTML += `
                <tr>
                    <td>${customer.name}</td>
                    <td>${item.type}</td>
                    <td style="text-align: right;">${item.boxCount}</td>
                    <td style="text-align: right;">${kg.toFixed(2)}</td>
                </tr>
            `;
        });
    });
    
    document.getElementById('rizky-list-total-boxes').textContent = totalBoxes;
    document.getElementById('rizky-list-total-kg').textContent = totalKg.toFixed(2) + ' kg';
}

export function openRizkyQuickCalcModal() {
    const modal = DOMElements.rizkyQuickCalcModal;
    const date = appState.ui.selectedDate;
    const needs = getDailyNeeds(date);
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    let neededKg = rizkySurovina ? (needs[rizkySurovina.id] || 0) : 0;
    
    // Subtract stock
    if (rizkySurovina) {
        const stockKg = (rizkySurovina.stock || 0) * (rizkySurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[rizkySurovina.id] || 0) * (rizkySurovina.boxWeight || 25);
        neededKg = Math.max(0, neededKg - stockKg);
    }

    document.getElementById('rizky-quick-total-needed').textContent = neededKg.toFixed(0) + ' kg';
    const perfInput = document.getElementById('rizky-quick-line-performance');
    perfInput.value = appState.rizkyConfig.linePerformance || 2500;
    
    const updateTime = () => {
        const perf = parseFloat(perfInput.value) || 2500;
        if (perf > 0) {
            const hours = neededKg / perf;
            const h = Math.floor(hours);
            const m = Math.round((hours - h) * 60);
            document.getElementById('rizky-quick-runtime').textContent = `${h} hod ${m} min`;
        } else {
            document.getElementById('rizky-quick-runtime').textContent = '-';
        }
        appState.rizkyConfig.linePerformance = perf;
        saveState();
    };
    
    perfInput.oninput = updateTime;
    updateTime();
    modal.classList.add('active');
}

// --- Maykawa Modal ---
export function openMaykawaModal() {
    DOMElements.productionActionsModal.classList.remove('active');
    const modal = DOMElements.maykawaModal;
    const date = appState.ui.selectedDate;
    document.getElementById('maykawa-date').textContent = new Date(date).toLocaleDateString('cs-CZ');
    
    // Load config
    const config = appState.maykawaConfig;
    document.getElementById('maykawa-bone-percent').value = config.bonePercent;
    document.getElementById('maykawa-skin-percent').value = config.skinPercent;
    document.getElementById('maykawa-deboning-speed').value = config.deboningSpeed;
    
    calculateMaykawa();
    
    ['maykawa-bone-percent', 'maykawa-skin-percent', 'maykawa-deboning-speed'].forEach(id => {
        document.getElementById(id).onchange = () => {
            appState.maykawaConfig = {
                bonePercent: parseFloat(document.getElementById('maykawa-bone-percent').value) || 0,
                skinPercent: parseFloat(document.getElementById('maykawa-skin-percent').value) || 0,
                deboningSpeed: parseFloat(document.getElementById('maykawa-deboning-speed').value) || 0,
            };
            saveState();
            calculateMaykawa();
        };
    });

    modal.classList.add('active');
}

function calculateMaykawa() {
    const date = appState.ui.selectedDate;
    const needs = getDailyNeeds(date);
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    const steakNeeded = steakSurovina ? (needs[steakSurovina.id] || 0) : 0;
    
    document.getElementById('maykawa-steak-needed').textContent = steakNeeded.toFixed(2);
    
    const { bonePercent, skinPercent, deboningSpeed } = appState.maykawaConfig;
    const yieldPercent = 100 - bonePercent - skinPercent;
    document.getElementById('maykawa-yield-percent').value = yieldPercent;
    
    if (yieldPercent <= 0) {
        document.getElementById('maykawa-total-percent-warning').style.display = 'block';
        return;
    }
    document.getElementById('maykawa-total-percent-warning').style.display = 'none';

    const thighsNeeded = steakNeeded / (yieldPercent / 100);
    document.getElementById('maykawa-thighs-needed-kg').textContent = thighsNeeded.toFixed(2);
    
    // Pallets (approx 500kg)
    const stehnaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
    const palletWeight = stehnaSurovina?.paletteWeight || 500;
    document.getElementById('maykawa-thighs-needed-pallets').textContent = (thighsNeeded / palletWeight).toFixed(2);
    
    document.getElementById('maykawa-bones-produced').textContent = (thighsNeeded * (bonePercent/100)).toFixed(2);
    document.getElementById('maykawa-skin-produced').textContent = (thighsNeeded * (skinPercent/100)).toFixed(2);
    
    if (deboningSpeed > 0) {
        const hours = thighsNeeded / deboningSpeed;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        document.getElementById('maykawa-needed-time').textContent = `${h} hod ${m} min`;
    } else {
        document.getElementById('maykawa-needed-time').textContent = '---';
    }
}

export function openMaykawaAddOrderModal() {
    DOMElements.maykawaAddOrderModal.classList.add('active');
    const container = document.getElementById('maykawa-add-order-modal-body');
    const date = appState.ui.selectedDate;
    document.getElementById('maykawa-add-order-date').textContent = new Date(date).toLocaleDateString('cs-CZ');
    
    let html = `<table class="data-table"><thead><tr><th>Zákazník</th><th>Typ</th><th>Počet beden</th></tr></thead><tbody>`;
    
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    if (!steakSurovina) return;

    appState.zakaznici.forEach(customer => {
        ['OA', 'RB', 'VL'].forEach(type => {
            const weights = appState.boxWeights[customer.id]?.[steakSurovina.id];
            if (weights && weights.isActive && weights[type] > 0) {
                 html += `
                    <tr>
                        <td>${customer.name}</td>
                        <td>${type}</td>
                        <td><input type="number" class="maykawa-order-input" data-customer-id="${customer.id}" data-type="${type}" min="0"></td>
                    </tr>
                 `;
            }
        });
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

export function saveMaykawaOrders() {
    const inputs = document.querySelectorAll('.maykawa-order-input');
    const date = appState.ui.selectedDate;
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    
    let added = false;
    inputs.forEach(input => {
        const val = parseInt(input.value);
        if (val > 0) {
            const { customerId, type } = input.dataset;
            let order = appState.orders.find(o => o.customerId === customerId && o.date === date);
            if (!order) {
                order = { id: generateId(), date, customerId, items: [] };
                appState.orders.push(order);
            }
            const item = order.items.find(i => i.surovinaId === steakSurovina.id && i.type === type);
            if (item) {
                item.boxCount += val;
            } else {
                order.items.push({ id: generateId(), surovinaId: steakSurovina.id, type, boxCount: val, isActive: true, doneCount: 0 });
            }
            added = true;
        }
    });
    
    if (added) {
        saveState();
        showToast('Objednávky steaku uloženy.');
        calculateMaykawa();
    }
    DOMElements.maykawaAddOrderModal.classList.remove('active');
}

export function openMaykawaOrderListModal() {
    DOMElements.maykawaOrderListModal.classList.add('active');
    const tbody = document.querySelector('#maykawa-order-list-table tbody');
    tbody.innerHTML = '';
    const date = appState.ui.selectedDate;
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    
    let totalBoxes = 0;
    let totalKg = 0;

    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.filter(i => i.surovinaId === steakSurovina?.id && i.isActive).forEach(item => {
            const customer = appState.zakaznici.find(c => c.id === order.customerId);
            const weightConfig = appState.boxWeights[customer.id]?.[steakSurovina.id];
            const weight = (weightConfig && weightConfig[item.type]) ? weightConfig[item.type] : 10000;
            const kg = item.boxCount * (weight / 1000);
            
            totalBoxes += item.boxCount;
            totalKg += kg;

            tbody.innerHTML += `
                <tr>
                    <td>${customer.name}</td>
                    <td>${item.type}</td>
                    <td style="text-align: right;">${item.boxCount}</td>
                    <td style="text-align: right;">${kg.toFixed(2)}</td>
                </tr>
            `;
        });
    });
    
    document.getElementById('maykawa-list-total-boxes').textContent = totalBoxes;
    document.getElementById('maykawa-list-total-kg').textContent = totalKg.toFixed(2) + ' kg';
}

// --- Minced Meat Modal ---
export function openMincedMeatModal() {
    DOMElements.productionActionsModal.classList.remove('active');
    DOMElements.mincedMeatModal.classList.add('active');
    renderMincedMeatModalContent();
}

export function renderMincedMeatModalContent() {
    const body = document.getElementById('minced-meat-modal-body');
    const date = appState.ui.selectedDate;
    const mincedSurovina = appState.suroviny.find(s => s.name === 'MLETÉ MASO');
    
    if (!mincedSurovina) {
        body.innerHTML = '<p>Surovina MLETÉ MASO nenalezena.</p>';
        return;
    }

    document.getElementById('minced-meat-date').textContent = new Date(date).toLocaleDateString('cs-CZ');

    // List orders
    let html = `<table class="data-table"><thead><tr><th>Zákazník</th><th>Typ</th><th>Množství</th><th>Stab.</th><th>Akce</th></tr></thead><tbody>`;
    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.filter(i => i.surovinaId === mincedSurovina.id && i.isActive).forEach(item => {
            const customer = appState.zakaznici.find(c => c.id === order.customerId);
            html += `<tr>
                <td>${customer.name}</td>
                <td>${item.type}</td>
                <td>${item.boxCount} ks</td>
                <td><input type="checkbox" ${item.isStabilized ? 'checked' : ''} data-action="toggle-item-stabilized" data-order-id="${order.id}" data-item-id="${item.id}"></td>
                <td class="actions"><button class="btn-icon danger" data-action="delete-minced-meat-order-item" data-order-id="${order.id}" data-item-id="${item.id}">${ICONS.trash}</button></td>
            </tr>`;
        });
    });
    html += `</tbody></table>`;
    body.innerHTML = html;
    feather.replace();
}

export function openAddMincedMeatOrderModal() {
    document.getElementById('add-minced-meat-order-modal').classList.add('active');
    const tbody = document.querySelector('#add-minced-meat-order-modal-body tbody');
    tbody.innerHTML = appState.zakaznici.map(c => `
        <tr>
            <td>${c.name}</td>
            <td><input type="number" class="minced-order-input" data-cid="${c.id}" data-type="OA" style="width:60px;" placeholder="0"></td>
            <td><input type="number" class="minced-order-input" data-cid="${c.id}" data-type="RB" style="width:60px;" placeholder="0"></td>
            <td><input type="number" class="minced-order-input" data-cid="${c.id}" data-type="VL" style="width:60px;" placeholder="0"></td>
        </tr>
    `).join('');
}

export function saveMincedMeatOrder() {
    const inputs = document.querySelectorAll('.minced-order-input');
    const date = appState.ui.selectedDate;
    const surovina = appState.suroviny.find(s => s.name === 'MLETÉ MASO');
    
    inputs.forEach(input => {
        const val = parseInt(input.value);
        if (val > 0) {
            const { cid, type } = input.dataset;
            let order = appState.orders.find(o => o.customerId === cid && o.date === date);
            if (!order) {
                order = { id: generateId(), date, customerId: cid, items: [] };
                appState.orders.push(order);
            }
            
            // Check default stabilization setting
            const isStabilized = appState.mincedMeatStabilizedDefaults[cid]?.[type] || false;
            
            order.items.push({ id: generateId(), surovinaId: surovina.id, type, boxCount: val, isActive: true, isStabilized: isStabilized });
        }
    });
    saveState();
    document.getElementById('add-minced-meat-order-modal').classList.remove('active');
    renderMincedMeatModalContent();
    showToast('Objednávky mletého masa uloženy.');
}

export function deleteMincedMeatOrderItem(orderId, itemId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (order) {
        order.items = order.items.filter(i => i.id !== itemId);
        saveState();
        renderMincedMeatModalContent();
    }
}

// --- Wings Modal ---
export function openWingsModal() {
    DOMElements.productionActionsModal.classList.remove('active');
    renderWingsProductionModal();
    DOMElements.wingsModal.classList.add('active');
}

export function renderWingsProductionModal() {
    const container = DOMElements.wingsModal.querySelector('#wings-production-table-container');
    const date = appState.ui.selectedDate;
    document.getElementById('wings-date').textContent = new Date(date).toLocaleDateString('cs-CZ');

    const wingsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'KŘÍDLA');
    if (!wingsSurovina) {
        container.innerHTML = '<p class="shortage">Surovina "KŘÍDLA" nebyla nalezena.</p>';
        return;
    }

    const customerOrders = {}; 
    appState.orders.filter(o => o.date === date).forEach(order => {
        order.items.forEach(item => {
            if (item.surovinaId === wingsSurovina.id && item.isActive) {
                if (!customerOrders[order.customerId]) {
                    const customer = appState.zakaznici.find(c => c.id === order.customerId);
                    customerOrders[order.customerId] = { name: customer.name, totalBoxes: 0 };
                }
                customerOrders[order.customerId].totalBoxes += item.boxCount;
            }
        });
    });

    if (Object.keys(customerOrders).length === 0) {
        container.innerHTML = '<p>Pro tento den nejsou žádné objednávky křídel.</p>';
        return;
    }

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th>Zákazník</th>
                <th>Objednáno (beden)</th>
                <th>Celkem misek</th>
                <th>Výrobní bedny (ks)</th>
                <th>Palety</th>
                <th>Zbývá (ks)</th>
            </tr>
        </thead>
        <tbody>`;

    for (const customerId in customerOrders) {
        const order = customerOrders[customerId];
        const config = appState.wingsPackagingConfig[customerId] || {};
        
        const traysPerOrderBox = config.traysPerOrderBox || 4;
        const traysPerProductionBox = config.traysPerBox || 12;
        const boxesPerPallet = config.boxesPerPallet || 36;

        const totalTrays = order.totalBoxes * traysPerOrderBox;
        const totalProductionBoxes = Math.ceil(totalTrays / traysPerProductionBox);
        
        // Calculate pallets and remaining
        const pallets = Math.floor(totalProductionBoxes / boxesPerPallet);
        const remainingBoxes = totalProductionBoxes % boxesPerPallet;
        
        // Precise pallet calculation for display
        const precisePallets = (totalProductionBoxes / boxesPerPallet).toFixed(2);

        tableHTML += `
            <tr>
                <td>
                    <strong>${order.name}</strong><br>
                    <span style="font-size: 0.8em; color: var(--text-secondary);">
                        (${traysPerOrderBox} mis./obj. -> ${traysPerProductionBox} mis./výr.)
                    </span>
                </td>
                <td>${order.totalBoxes}</td>
                <td>${totalTrays}</td>
                <td style="font-weight: bold; color: var(--accent-primary);">${totalProductionBoxes}</td>
                <td>${pallets} <span style="font-size: 0.8em; color: var(--text-secondary);">(${precisePallets})</span></td>
                <td class="${remainingBoxes > 0 ? 'shortage' : 'surplus'}">${remainingBoxes}</td>
            </tr>
        `;
    }

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

export function openWingsSettingsModal() {
    const modal = document.getElementById('wings-settings-modal');
    const customerSelect = modal.querySelector('#wings-settings-customer');
    
    customerSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    const loadConfig = () => {
        const custId = customerSelect.value;
        const config = appState.wingsPackagingConfig[custId] || { traysPerOrderBox: 4, traysPerBox: 12, boxesPerPallet: 36 };
        modal.querySelector('#wings-settings-trays-per-order-box').value = config.traysPerOrderBox;
        modal.querySelector('#wings-settings-trays-per-box').value = config.traysPerBox;
        modal.querySelector('#wings-settings-boxes-per-pallet').value = config.boxesPerPallet;
    };
    
    customerSelect.onchange = loadConfig;
    loadConfig();
    
    modal.classList.add('active');
}

export function saveWingsSettings() {
    const modal = document.getElementById('wings-settings-modal');
    const custId = modal.querySelector('#wings-settings-customer').value;
    
    if (!appState.wingsPackagingConfig[custId]) appState.wingsPackagingConfig[custId] = {};
    
    appState.wingsPackagingConfig[custId].traysPerOrderBox = parseInt(modal.querySelector('#wings-settings-trays-per-order-box').value) || 4;
    appState.wingsPackagingConfig[custId].traysPerBox = parseInt(modal.querySelector('#wings-settings-trays-per-box').value) || 12;
    appState.wingsPackagingConfig[custId].boxesPerPallet = parseInt(modal.querySelector('#wings-settings-boxes-per-pallet').value) || 36;
    
    saveState();
    modal.classList.remove('active');
    renderWingsProductionModal();
    showToast('Nastavení křídel uloženo.');
}

export function exportWingsToPdf() {
    showToast('Export PDF pro křídla (demo).');
}

// --- Surovina Source Modals ---
export function openSurovinaSourceModal() {
    document.getElementById('surovina-source-modal').classList.add('active');
}

export function openAddSurovinyModalFromStock() {
    document.getElementById('surovina-source-modal').classList.remove('active');
    const modal = document.getElementById('add-suroviny-modal');
    modal.classList.add('active');
    document.getElementById('add-suroviny-modal-body').innerHTML = `
        <div class="form-group">
            <label>Surovina</label>
            <select id="add-surovina-select" class="form-input">
                ${appState.suroviny.filter(s => s.isActive && !s.isProduct && !s.isMix).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Počet palet</label>
            <input type="number" id="add-surovina-pallets" class="form-input" min="1" value="1">
        </div>
    `;
    // We attach a dataset to the save button to know context if needed, or just handle generically
}

export function openAddSurovinyModalFromProduction() {
    // Same modal, just potentially different processing if we tracked provenance
    openAddSurovinyModalFromStock();
}

export function saveAddedSuroviny() {
    const surovinaId = document.getElementById('add-surovina-select').value;
    const pallets = parseFloat(document.getElementById('add-surovina-pallets').value);
    
    if (surovinaId && pallets > 0) {
        const surovina = appState.suroviny.find(s => s.id === surovinaId);
        if (surovina) {
            surovina.stock = (surovina.stock || 0) + pallets;
            saveState();
            showToast(`Přidáno ${pallets} palet suroviny ${surovina.name}.`);
        }
    }
    document.getElementById('add-suroviny-modal').classList.remove('active');
}
