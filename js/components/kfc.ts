/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, showToast } from '../ui.ts';
import { getKfcSurovinyNeeds } from '../services/calculations.ts';
import { renderMainPage } from './mainPage.ts';

export function renderKFC() {
    const date = appState.ui.selectedDate;
    const order = appState.kfcOrders[date] || { today: {}, tomorrow: {} };
    const orderTbody = document.querySelector('#kfc-order-table tbody');
    orderTbody.innerHTML = '';
    let totalMinutes = 0;

    appState.kfcProducts.forEach(product => {
        const orderData = order.today[product.id] || { ordered: 0, produced: 0 };
        const orderedCount = orderData.ordered || 0;
        const producedCount = orderData.produced || 0;
        const missingCount = orderedCount - producedCount;
        const tomorrowCount = order.tomorrow[product.id]?.ordered || 0;

        if (missingCount > 0) {
            totalMinutes += missingCount * (product.minutesPerBox || 10);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${product.name}</td>
            <td><input type="number" class="kfc-produced-input" data-product-id="${product.id}" value="${producedCount}" style="width: 80px;"></td>
            <td>${orderedCount}</td>
            <td class="${missingCount > 0 ? 'shortage' : ''}">${missingCount}</td>
            <td>${tomorrowCount}</td>
        `;
        orderTbody.appendChild(tr);
    });

    const timeEl = document.getElementById('kfc-total-time');
    if (timeEl) {
        if (totalMinutes > 0) {
            const addedStaff = order.addedStaff || 0;
            const totalStaff = 1 + addedStaff;
            const newTotalMinutes = totalMinutes / totalStaff;
            const kfcStartTime = 8 * 60; // 08:00
            const endMinuteOfDay = kfcStartTime + newTotalMinutes;
            
            const endHour = Math.floor(endMinuteOfDay / 60) % 24;
            const endMinute = Math.round(endMinuteOfDay % 60);

            timeEl.textContent = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        } else {
            timeEl.textContent = 'Hotovo';
        }
    }

    const surovinyNeeded = getKfcSurovinyNeeds(date);
    const surovinyTbody = document.querySelector('#kfc-suroviny-needed-table tbody');
    surovinyTbody.innerHTML = '';

    appState.kfcSuroviny.forEach(surovina => {
        const needed = surovinyNeeded[surovina.id] || 0;
        const stock = surovina.stockBoxes || 0;
        const balance = stock - needed;
        let balanceHtml = `<span class="${balance < 0 ? 'shortage' : 'surplus'}">${balance}</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${surovina.name}</td>
            <td>${needed}</td>
            <td>${stock}</td>
            <td>${balanceHtml}</td>
        `;
        surovinyTbody.appendChild(tr);
    });
}

export function handleKfcProductionChange(target) {
    const { productId } = target.dataset;
    const date = appState.ui.selectedDate;
    const orderData = appState.kfcOrders[date]?.today?.[productId];
    if (orderData) {
        orderData.produced = parseInt(target.value) || 0;
        saveState();
        renderKFC();
    }
}

export function saveKfcProducts() {
    const newProducts = [];
    const rows = document.querySelectorAll('#kfc-products-table tbody tr');
    rows.forEach(row => {
        const id = row.dataset.id;
        const nameInput = row.querySelector('.kfc-product-name');
        const weightInput = row.querySelector('.kfc-product-box-weight');
        const minutesInput = row.querySelector('.kfc-product-minutes');
        const surovinaSelect = row.querySelector('.kfc-product-surovina');
        newProducts.push({
            id: id,
            name: nameInput.value.trim(),
            boxWeight: parseInt(weightInput.value) || 10000,
            minutesPerBox: parseInt(minutesInput.value) || 10,
            requiredSurovinaId: surovinaSelect.value,
        });
    });
    appState.kfcProducts = newProducts;
    saveState();
    renderKfcProductsPage();
    showToast('KFC produkty uloženy.');
}

export function saveKfcOrder() {
    const date = appState.ui.selectedDate;
    if (!appState.kfcOrders[date]) {
        appState.kfcOrders[date] = { today: {}, tomorrow: {}, addedStaff: 0 };
    }
    
    const rows = DOMElements.kfcAddOrderModal.querySelectorAll('#kfc-add-order-table tbody tr');
    rows.forEach(row => {
        const productId = row.dataset.id;
        const todayInput = row.querySelector('.kfc-order-today');
        const tomorrowInput = row.querySelector('.kfc-order-tomorrow');
        const todayCount = parseInt(todayInput.value) || 0;
        const tomorrowCount = parseInt(tomorrowInput.value) || 0;
        
        if (!appState.kfcOrders[date].today[productId]) {
             appState.kfcOrders[date].today[productId] = { ordered: 0, produced: 0 };
        }
        if (!appState.kfcOrders[date].tomorrow[productId]) {
             appState.kfcOrders[date].tomorrow[productId] = { ordered: 0, produced: 0 };
        }

        appState.kfcOrders[date].today[productId].ordered = todayCount;
        appState.kfcOrders[date].tomorrow[productId].ordered = tomorrowCount;
    });
    saveState();
    DOMElements.kfcAddOrderModal.classList.remove('active');
    renderKFC();
    renderMainPage();
    showToast('KFC objednávka uložena.');
}

export function saveKfcStock() {
    const rows = DOMElements.kfcStockModal.querySelectorAll('#kfc-stock-table tbody tr');
    rows.forEach(row => {
        const surovinaId = row.dataset.id;
        const stockInput = row.querySelector('.kfc-stock-boxes');
        const weightInput = row.querySelector('.kfc-stock-box-weight');
        const surovina = appState.kfcSuroviny.find(s => s.id === surovinaId);
        if (surovina) {
            surovina.stockBoxes = parseInt(stockInput.value) || 0;
            surovina.boxWeight = parseInt(weightInput.value) || 10000;
        }
    });
    saveState();
    DOMElements.kfcStockModal.classList.remove('active');
    renderKFC();
    showToast('Sklad KFC uložen.');
}

export function saveKfcStaff() {
    const date = appState.ui.selectedDate;
    const addedStaff = parseInt(DOMElements.kfcStaffModal.querySelector('#kfc-staff-added').value) || 0;

    if (!appState.kfcOrders[date]) {
        appState.kfcOrders[date] = { today: {}, tomorrow: {}, addedStaff: 0 };
    }
    appState.kfcOrders[date].addedStaff = addedStaff;
    
    saveState();
    DOMElements.kfcStaffModal.classList.remove('active');
    renderKFC();
    showToast('Počet pracovníků pro KFC uložen.');
}

export function renderKfcProductsPage() {
    const tbody = document.querySelector('#kfc-products-table tbody');
    tbody.innerHTML = '';
    const surovinyOptions = appState.kfcSuroviny.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    appState.kfcProducts.forEach(product => {
        const tr = document.createElement('tr');
        tr.dataset.id = product.id;
        tr.innerHTML = `
            <td><input type="text" class="kfc-product-name" value="${product.name}"></td>
            <td><input type="number" class="kfc-product-box-weight" value="${product.boxWeight}" style="width: 120px;"></td>
            <td><input type="number" class="kfc-product-minutes" value="${product.minutesPerBox}" style="width: 80px;"></td>
            <td><select class="kfc-product-surovina">${surovinyOptions}</select></td>
        `;
        tr.querySelector('.kfc-product-surovina').value = product.requiredSurovinaId;
        tbody.appendChild(tr);
    });
}

export function openKfcAddOrderModal() {
    const modal = DOMElements.kfcAddOrderModal;
    const date = appState.ui.selectedDate;
    modal.querySelector('#kfc-order-date').textContent = new Date(date).toLocaleDateString('cs-CZ');
    const tbody = modal.querySelector('#kfc-add-order-table tbody');
    tbody.innerHTML = '';
    const order = appState.kfcOrders[date] || { today: {}, tomorrow: {} };

    appState.kfcProducts.forEach(product => {
        const todayOrdered = order.today[product.id]?.ordered || 0;
        const tomorrowOrdered = order.tomorrow[product.id]?.ordered || 0;
        const tr = document.createElement('tr');
        tr.dataset.id = product.id;
        tr.innerHTML = `
            <td>${product.name}</td>
            <td><input type="number" class="kfc-order-today" value="${todayOrdered > 0 ? todayOrdered : ''}" style="width: 120px;"></td>
            <td><input type="number" class="kfc-order-tomorrow" value="${tomorrowOrdered > 0 ? tomorrowOrdered : ''}" style="width: 120px;"></td>
        `;
        tbody.appendChild(tr);
    });
    modal.classList.add('active');
}

export function openKfcStockModal() {
    const modal = DOMElements.kfcStockModal;
    const tbody = modal.querySelector('#kfc-stock-table tbody');
    tbody.innerHTML = '';
    appState.kfcSuroviny.forEach(surovina => {
        const tr = document.createElement('tr');
        tr.dataset.id = surovina.id;
        tr.innerHTML = `
            <td>${surovina.name}</td>
            <td><input type="number" class="kfc-stock-boxes" value="${surovina.stockBoxes}" style="width: 120px;"></td>
            <td><input type="number" class="kfc-stock-box-weight" value="${surovina.boxWeight}" style="width: 120px;"></td>
        `;
        tbody.appendChild(tr);
    });
    modal.classList.add('active');
}

export function openKfcStaffModal() {
    const modal = DOMElements.kfcStaffModal;
    const date = appState.ui.selectedDate;
    const addedStaff = appState.kfcOrders[date]?.addedStaff || 0;
    modal.querySelector('#kfc-staff-added').value = addedStaff > 0 ? addedStaff : '';
    calculateKfcStaffing();
    modal.classList.add('active');
}

export function calculateKfcStaffing() {
    const modal = DOMElements.kfcStaffModal;
    const date = appState.ui.selectedDate;
    const order = appState.kfcOrders[date] || { today: {} };
    let totalMinutes = 0;

    appState.kfcProducts.forEach(product => {
        const orderData = order.today[product.id] || { ordered: 0, produced: 0 };
        const missingCount = (orderData.ordered || 0) - (orderData.produced || 0);
        if (missingCount > 0) {
            totalMinutes += missingCount * (product.minutesPerBox || 10);
        }
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    modal.querySelector('#kfc-staff-total-time').textContent = `${totalHours} hod ${remainingMinutes} min`;

    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const minutesToMidnight = (midnight - now) / 60000;

    if (minutesToMidnight <= 0 || totalMinutes === 0) {
         modal.querySelector('#kfc-staff-needed').textContent = 'N/A';
    } else {
        const staffNeeded = Math.ceil(totalMinutes / minutesToMidnight);
        modal.querySelector('#kfc-staff-needed').textContent = staffNeeded;
    }

    const baseStaff = 1;
    const addedStaff = parseInt(modal.querySelector('#kfc-staff-added').value) || 0;
    const totalStaff = baseStaff + addedStaff;

    if (totalStaff > 0) {
        const newTotalMinutes = totalMinutes / totalStaff;
        const kfcStartTime = 8 * 60; // Assume start at 08:00
        const endMinuteOfDay = kfcStartTime + newTotalMinutes;
        
        const endHour = Math.floor(endMinuteOfDay / 60) % 24;
        const endMinute = Math.round(endMinuteOfDay % 60);

        modal.querySelector('#kfc-new-completion-time').textContent = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    } else {
        modal.querySelector('#kfc-new-completion-time').textContent = 'N/A';
    }
}
