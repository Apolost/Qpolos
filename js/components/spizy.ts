/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast, showConfirmation } from '../ui.ts';
import { getSpizyNeeds } from '../services/calculations.ts';
import { generateId } from '../utils.ts';
import { renderMainPage } from './mainPage.ts';

function updateSpizyTotals() {
    const totalSpek = (parseFloat(document.getElementById('spizy-config-spek-spek').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-klobasa').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-cibule').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-steak').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-paprika').value) || 0);
    const totalKlobasa = (parseFloat(document.getElementById('spizy-config-klobasa-steak').value) || 0) + (parseFloat(document.getElementById('spizy-config-klobasa-klobasa').value) || 0) + (parseFloat(document.getElementById('spizy-config-klobasa-cibule').value) || 0) + (parseFloat(document.getElementById('spizy-config-klobasa-paprika').value) || 0);

    const totalSpekEl = document.getElementById('spizy-total-spek');
    totalSpekEl.textContent = totalSpek;
    totalSpekEl.style.color = Math.abs(totalSpek - 100) > 0.1 ? 'var(--accent-danger)' : 'var(--accent-success)';
    
    const totalKlobasaEl = document.getElementById('spizy-total-klobasa');
    totalKlobasaEl.textContent = totalKlobasa;
    totalKlobasaEl.style.color = Math.abs(totalKlobasa - 100) > 0.1 ? 'var(--accent-danger)' : 'var(--accent-success)';
}

export function handleSpizySettingsInput() {
    updateSpizyTotals();
}

export function renderSpizySettings() {
    const { spek, klobasa } = appState.spizyConfig;
    document.getElementById('spizy-config-spek-spek').value = spek.spek;
    document.getElementById('spizy-config-spek-klobasa').value = spek.klobasa;
    document.getElementById('spizy-config-spek-cibule').value = spek.cibule;
    document.getElementById('spizy-config-spek-steak').value = spek.steak;
    document.getElementById('spizy-config-spek-paprika').value = spek.paprika;
    document.getElementById('spizy-config-klobasa-steak').value = klobasa.steak;
    document.getElementById('spizy-config-klobasa-klobasa').value = klobasa.klobasa;
    document.getElementById('spizy-config-klobasa-cibule').value = klobasa.cibule;
    document.getElementById('spizy-config-klobasa-paprika').value = klobasa.paprika;
    
    updateSpizyTotals();
}

export function saveSpizySettings() {
    const totalSpek = (parseFloat(document.getElementById('spizy-config-spek-spek').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-klobasa').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-cibule').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-steak').value) || 0) + (parseFloat(document.getElementById('spizy-config-spek-paprika').value) || 0);
    const totalKlobasa = (parseFloat(document.getElementById('spizy-config-klobasa-steak').value) || 0) + (parseFloat(document.getElementById('spizy-config-klobasa-klobasa').value) || 0) + (parseFloat(document.getElementById('spizy-config-klobasa-cibule').value) || 0) + (parseFloat(document.getElementById('spizy-config-klobasa-paprika').value) || 0);

    if (Math.abs(totalSpek - 100) > 0.1 || Math.abs(totalKlobasa - 100) > 0.1) {
        showToast('Složení pro Špíz Špek i Špíz Klobása musí být dohromady 100 %.', 'error');
        return;
    }

    appState.spizyConfig.spek.spek = parseFloat(document.getElementById('spizy-config-spek-spek').value) || 0;
    appState.spizyConfig.spek.klobasa = parseFloat(document.getElementById('spizy-config-spek-klobasa').value) || 0;
    appState.spizyConfig.spek.cibule = parseFloat(document.getElementById('spizy-config-spek-cibule').value) || 0;
    appState.spizyConfig.spek.steak = parseFloat(document.getElementById('spizy-config-spek-steak').value) || 0;
    appState.spizyConfig.spek.paprika = parseFloat(document.getElementById('spizy-config-spek-paprika').value) || 0;
    appState.spizyConfig.klobasa.steak = parseFloat(document.getElementById('spizy-config-klobasa-steak').value) || 0;
    appState.spizyConfig.klobasa.klobasa = parseFloat(document.getElementById('spizy-config-klobasa-klobasa').value) || 0;
    appState.spizyConfig.klobasa.cibule = parseFloat(document.getElementById('spizy-config-klobasa-cibule').value) || 0;
    appState.spizyConfig.klobasa.paprika = parseFloat(document.getElementById('spizy-config-klobasa-paprika').value) || 0;
    saveState();
    showToast('Nastavení špízů uloženo.');
}

export function openSpizyModal() {
    DOMElements.spizyModal.querySelector('#spizy-modal-date').textContent = new Date(appState.ui.selectedDate).toLocaleDateString('cs-CZ');
    renderSpizyModalContent();
    DOMElements.spizyModal.classList.add('active');
}

function renderSpizyModalContent() {
     const date = appState.ui.selectedDate;
     const orders = appState.spizyOrders[date] || [];
     const body = DOMElements.spizyModal.querySelector('.modal-body');

     let ordersHtml = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Objednávky</h3></div>
            <div class="card-content">
                <table class="data-table">
                    <thead><tr><th>Zákazník</th><th>Klobása (bedny)</th><th>Špek (bedny)</th><th>Čilli Mango (bedny)</th><th class="actions">Akce</th></tr></thead>
                    <tbody>
     `;
     if (orders.length > 0) {
         orders.forEach(order => {
            const customer = appState.zakaznici.find(c => c.id === order.customerId);
            ordersHtml += `
                <tr>
                    <td>${customer.name}</td>
                    <td>${order.klobasa}</td>
                    <td>${order.spek}</td>
                    <td>${order.cilli}</td>
                    <td class="actions">
                        <button class="btn-icon" data-action="edit-spizy-order" data-id="${order.id}">${ICONS.edit}</button>
                        <button class="btn-icon danger" data-action="delete-spizy-order" data-id="${order.id}">${ICONS.trash}</button>
                    </td>
                </tr>
            `;
         });
     } else {
         ordersHtml += '<tr><td colspan="5" style="text-align: center;">Žádné objednávky</td></tr>';
     }
     ordersHtml += '</tbody></table></div></div>';
     
     const needs = getSpizyNeeds(date);
     let needsHtml = `
        <div class="card">
             <div class="card-header"><h3 class="card-title">Potřeba surovin</h3></div>
             <div class="card-content">
                <table class="data-table">
                 <thead><tr><th>Surovina</th><th>Potřeba (kg)</th><th>Skladem (kg)</th><th>Chybí / Přebývá (kg)</th></tr></thead>
                 <tbody>
                    <tr><td>Klobása</td><td>${needs.klobasa.toFixed(2)}</td><td>${appState.spizyStock.klobasa.toFixed(2)}</td><td class="${(appState.spizyStock.klobasa - needs.klobasa) < 0 ? 'shortage' : 'surplus'}">${(appState.spizyStock.klobasa - needs.klobasa).toFixed(2)}</td></tr>
                    <tr><td>Špek</td><td>${needs.spek.toFixed(2)}</td><td>${appState.spizyStock.spek.toFixed(2)}</td><td class="${(appState.spizyStock.spek - needs.spek) < 0 ? 'shortage' : 'surplus'}">${(appState.spizyStock.spek - needs.spek).toFixed(2)}</td></tr>
                    <tr><td>Steak (na Špíz)</td><td>${needs.steak.toFixed(2)}</td><td>${appState.spizyStock.steak.toFixed(2)}</td><td class="${(appState.spizyStock.steak - needs.steak) < 0 ? 'shortage' : 'surplus'}">${(appState.spizyStock.steak - needs.steak).toFixed(2)}</td></tr>
                    <tr><td>Cibule</td><td>${needs.cibule.toFixed(2)}</td><td>${appState.spizyStock.cibule.toFixed(2)}</td><td class="${(appState.spizyStock.cibule - needs.cibule) < 0 ? 'shortage' : 'surplus'}">${(appState.spizyStock.cibule - needs.cibule).toFixed(2)}</td></tr>
                    <tr><td>Paprika</td><td>${needs.paprika.toFixed(2)}</td><td>${appState.spizyStock.paprika.toFixed(2)}</td><td class="${(appState.spizyStock.paprika - needs.paprika) < 0 ? 'shortage' : 'surplus'}">${(appState.spizyStock.paprika - needs.paprika).toFixed(2)}</td></tr>
                    <tr><td>Řízky (na Čilli)</td><td>${needs.rizky.toFixed(2)}</td><td colspan="2">Řídí se hlavním skladem</td></tr>
                 </tbody>
                </table>
             </div>
        </div>
     `;

     let ingredientOrdersHtml = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Objednané suroviny</h3></div>
            <div class="card-content">
                <table class="data-table">
                     <thead><tr><th>Datum doručení</th><th>Surovina</th><th>Množství (kg)</th><th class="actions">Akce</th></tr></thead>
                     <tbody>
     `;
     const sortedIngredientOrders = [...appState.spizyIngredientOrders].sort((a,b) => new Date(a.date) - new Date(b.date));
     if (sortedIngredientOrders.length > 0) {
         sortedIngredientOrders.forEach(order => {
            const orderDate = new Date(order.date + 'T00:00:00').toLocaleDateString('cs-CZ');
            const items = [];
            if (order.klobasa > 0) items.push({name: 'Klobása', qty: order.klobasa});
            if (order.spek > 0) items.push({name: 'Špek', qty: order.spek});
            if (order.cibule > 0) items.push({name: 'Cibule', qty: order.cibule});
            if (order.paprika > 0) items.push({name: 'Paprika', qty: order.paprika});

            if (items.length > 0) {
                items.forEach((item, index) => {
                    ingredientOrdersHtml += `
                        <tr>
                            ${index === 0 ? `<td rowspan="${items.length}">${orderDate}</td>` : ''}
                            <td>${item.name}</td>
                            <td>${item.qty}</td>
                            ${index === 0 ? `
                                <td rowspan="${items.length}" class="actions">
                                    <button class="btn-icon" data-action="edit-spizy-ingredient-order" data-id="${order.id}">${ICONS.edit}</button>
                                    <button class="btn-icon danger" data-action="delete-spizy-ingredient-order" data-id="${order.id}">${ICONS.trash}</button>
                                </td>
                            ` : ''}
                        </tr>
                    `;
                });
            }
         });
     } else {
         ingredientOrdersHtml += '<tr><td colspan="4" style="text-align: center;">Žádné objednané suroviny</td></tr>';
     }
     ingredientOrdersHtml += '</tbody></table></div></div>';

     body.innerHTML = ordersHtml + needsHtml + ingredientOrdersHtml;
     feather.replace();
}

export function openSpizyAddOrderModal(orderId = null) {
    const modal = DOMElements.spizyAddOrderModal;
    const customerSelect = modal.querySelector('#spizy-order-customer');
    customerSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    const klobasaInput = modal.querySelector('#spizy-order-klobasa');
    const spekInput = modal.querySelector('#spizy-order-spek');
    const cilliInput = modal.querySelector('#spizy-order-cilli');
    const title = modal.querySelector('#spizy-add-order-modal-title');

    appState.ui.editingSpizyOrderId = orderId;
    
    if (orderId) {
        title.textContent = "Upravit objednávku špízů";
        const date = appState.ui.selectedDate;
        const order = appState.spizyOrders[date]?.find(o => o.id === orderId);
        if(order) {
            customerSelect.value = order.customerId;
            klobasaInput.value = order.klobasa || '';
            spekInput.value = order.spek || '';
            cilliInput.value = order.cilli || '';
        }
    } else {
        title.textContent = "Přidat objednávku špízů";
        customerSelect.value = appState.zakaznici[0]?.id || '';
        klobasaInput.value = '';
        spekInput.value = '';
        cilliInput.value = '';
    }
    
    modal.classList.add('active');
}

export function saveSpizyOrder() {
    const date = appState.ui.selectedDate;
    const customerId = document.getElementById('spizy-order-customer').value;
    const klobasa = parseInt(document.getElementById('spizy-order-klobasa').value) || 0;
    const spek = parseInt(document.getElementById('spizy-order-spek').value) || 0;
    const cilli = parseInt(document.getElementById('spizy-order-cilli').value) || 0;

    if (!customerId || (klobasa === 0 && spek === 0 && cilli === 0)) {
        showToast('Vyberte zákazníka a zadejte počet beden.', 'error');
        return;
    }

    if (!appState.spizyOrders[date]) appState.spizyOrders[date] = [];

    if (appState.ui.editingSpizyOrderId) {
        const order = appState.spizyOrders[date].find(o => o.id === appState.ui.editingSpizyOrderId);
        if (order) {
            order.customerId = customerId;
            order.klobasa = klobasa;
            order.spek = spek;
            order.cilli = cilli;
        }
         showToast('Objednávka špízů upravena.');
    } else {
        appState.spizyOrders[date].push({ 
            id: generateId(), customerId, klobasa, spek, cilli,
            klobasaDone: 0, spekDone: 0, cilliDone: 0,
            klobasaIsDone: false, spekIsDone: false, cilliIsDone: false
        });
        showToast('Objednávka špízů uložena.');
    }
    
    appState.ui.editingSpizyOrderId = null;
    saveState();
    DOMElements.spizyAddOrderModal.classList.remove('active');
    renderSpizyModalContent();
    renderMainPage();
}

export function deleteSpizyOrder(orderId) {
    const date = appState.ui.selectedDate;
    if (appState.spizyOrders[date]) {
        showConfirmation('Opravdu chcete smazat tuto objednávku špízů?', () => {
            appState.spizyOrders[date] = appState.spizyOrders[date].filter(o => o.id !== orderId);
            saveState();
            renderSpizyModalContent();
            renderMainPage();
            showToast('Objednávka smazána', 'success');
        });
    }
}

export function openSpizyStockModal() {
    const modal = DOMElements.spizyStockModal;
    modal.querySelector('#spizy-stock-klobasa').value = appState.spizyStock.klobasa;
    modal.querySelector('#spizy-stock-spek').value = appState.spizyStock.spek;
    modal.querySelector('#spizy-stock-steak').value = appState.spizyStock.steak;
    modal.querySelector('#spizy-stock-cibule').value = appState.spizyStock.cibule;
    modal.querySelector('#spizy-stock-paprika').value = appState.spizyStock.paprika;
    modal.classList.add('active');
}

export function saveSpizyStock() {
    appState.spizyStock.klobasa = parseFloat(document.getElementById('spizy-stock-klobasa').value) || 0;
    appState.spizyStock.spek = parseFloat(document.getElementById('spizy-stock-spek').value) || 0;
    appState.spizyStock.steak = parseFloat(document.getElementById('spizy-stock-steak').value) || 0;
    appState.spizyStock.cibule = parseFloat(document.getElementById('spizy-stock-cibule').value) || 0;
    appState.spizyStock.paprika = parseFloat(document.getElementById('spizy-stock-paprika').value) || 0;
    saveState();
    DOMElements.spizyStockModal.classList.remove('active');
    renderSpizyModalContent();
    showToast('Sklad špízů uložen.');
}

export function openSpizyIngredientOrderModal(orderId = null) {
    const modal = DOMElements.spizyIngredientOrderModal;
    const dateInput = modal.querySelector('#spizy-ingredient-order-date');
    const klobasaInput = modal.querySelector('#spizy-ingredient-order-klobasa');
    const spekInput = modal.querySelector('#spizy-ingredient-order-spek');
    const cibuleInput = modal.querySelector('#spizy-ingredient-order-cibule');
    const paprikaInput = modal.querySelector('#spizy-ingredient-order-paprika');
    const title = modal.querySelector('#spizy-ingredient-order-modal-title');

    appState.ui.editingSpizyIngredientOrderId = orderId;

    if (orderId) {
        const order = appState.spizyIngredientOrders.find(o => o.id === orderId);
        if (order) {
            title.textContent = 'Upravit objednávku suroviny';
            dateInput.value = order.date;
            klobasaInput.value = order.klobasa || '';
            spekInput.value = order.spek || '';
            cibuleInput.value = order.cibule || '';
            paprikaInput.value = order.paprika || '';
        }
    } else {
        title.textContent = 'Objednat surovinu';
        dateInput.value = new Date().toISOString().split('T')[0];
        klobasaInput.value = '';
        spekInput.value = '';
        cibuleInput.value = '';
        paprikaInput.value = '';
    }

    modal.classList.add('active');
}

export function saveSpizyIngredientOrder() {
    const modal = DOMElements.spizyIngredientOrderModal;
    const orderData = {
        date: modal.querySelector('#spizy-ingredient-order-date').value,
        klobasa: parseFloat(modal.querySelector('#spizy-ingredient-order-klobasa').value) || 0,
        spek: parseFloat(modal.querySelector('#spizy-ingredient-order-spek').value) || 0,
        cibule: parseFloat(modal.querySelector('#spizy-ingredient-order-cibule').value) || 0,
        paprika: parseFloat(modal.querySelector('#spizy-ingredient-order-paprika').value) || 0,
    };

    if (!orderData.date) {
        showToast('Vyberte datum doručení.', 'error');
        return;
    }

    if (appState.ui.editingSpizyIngredientOrderId) {
        const index = appState.spizyIngredientOrders.findIndex(o => o.id === appState.ui.editingSpizyIngredientOrderId);
        if (index > -1) {
            appState.spizyIngredientOrders[index] = { ...appState.spizyIngredientOrders[index], ...orderData };
            showToast('Objednávka suroviny upravena.');
        }
    } else {
        appState.spizyIngredientOrders.push({ id: generateId(), ...orderData });
        showToast('Objednávka suroviny uložena.');
    }

    appState.ui.editingSpizyIngredientOrderId = null;
    saveState();
    modal.classList.remove('active');
    renderSpizyModalContent();
}

export function deleteSpizyIngredientOrder(orderId) {
    showConfirmation('Opravdu chcete smazat tuto objednávku suroviny?', () => {
        appState.spizyIngredientOrders = appState.spizyIngredientOrders.filter(o => o.id !== orderId);
        saveState();
        renderSpizyModalContent();
        showToast('Objednávka suroviny smazána.', 'success');
    });
}