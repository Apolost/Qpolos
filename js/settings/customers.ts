/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderCustomers() {
    const tbody = document.getElementById('customers-table-body');
    tbody.innerHTML = '';
    appState.zakaznici.forEach(customer => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${customer.name}</td>
            <td><input type="time" class="customer-order-reception-time" data-id="${customer.id}" value="${customer.orderReceptionTime || '12:00'}"></td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-customer" data-id="${customer.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-customer" data-id="${customer.id}">${ICONS.trash}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    cancelEditCustomer();
    feather.replace();
}

export function openCustomerEditor(customerId) {
    const customer = appState.zakaznici.find(c => c.id === customerId);
    if (!customer) return;

    appState.ui.editingCustomerId = customerId;
    document.getElementById('customer-form-header').textContent = `Upravit zákazníka: ${customer.name}`;
    document.getElementById('customer-name').value = customer.name;
    document.getElementById('save-customer-btn').innerHTML = `<i data-feather="save"></i>Uložit změny`;
    document.getElementById('cancel-edit-customer-btn').style.display = 'inline-block';
    
    feather.replace();
    window.scrollTo(0, 0);
}

export function cancelEditCustomer() {
    appState.ui.editingCustomerId = null;
    document.getElementById('customer-form-header').textContent = 'Přidat nového zákazníka';
    document.getElementById('customer-name').value = '';
    document.getElementById('save-customer-btn').innerHTML = `<i data-feather="save"></i>Uložit zákazníka`;
    document.getElementById('cancel-edit-customer-btn').style.display = 'none';
    feather.replace();
}

export function saveAllCustomers() {
    document.querySelectorAll('.customer-order-reception-time').forEach(input => {
        const customer = appState.zakaznici.find(c => c.id === input.dataset.id);
        if (customer) {
            customer.orderReceptionTime = input.value || '12:00';
        }
    });
    saveState();
    showToast('Změny u zákazníků uloženy');
    renderCustomers();
}


export function saveCustomer() {
    const nameInput = document.getElementById('customer-name');
    const name = nameInput.value.trim();
    if (!name) {
        showToast('Zadejte název zákazníka.', 'error');
        return;
    }

    const isEditing = !!appState.ui.editingCustomerId;
    const isDuplicate = appState.zakaznici.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== appState.ui.editingCustomerId);
    if (isDuplicate) {
        showToast('Zákazník s tímto názvem již existuje.', 'error');
        return;
    }

    if (isEditing) {
        const customer = appState.zakaznici.find(c => c.id === appState.ui.editingCustomerId);
        if (customer) {
            customer.name = name;
            showToast('Zákazník upraven.');
        }
    } else {
        const newCustomerId = generateId();
        appState.zakaznici.push({ id: newCustomerId, name, orderReceptionTime: '12:00' });
        // Initialize boxWeights for the new customer
        appState.boxWeights[newCustomerId] = {};
        appState.suroviny.forEach(s => {
            appState.boxWeights[newCustomerId][s.id] = { OA: 4000, RB: 4000, VL: 10000, isActive: true };
        });
        showToast('Nový zákazník přidán.');
    }
    
    saveState();
    renderCustomers();
    nameInput.value = '';
}

export function deleteCustomer(customerId) {
    const isUsedInOrders = appState.orders.some(o => o.customerId === customerId);
    const isUsedInProducts = appState.products.some(p => p.customerId === customerId);
    const isUsedInActions = appState.plannedActions.some(a => a.customerId === customerId);

    if (isUsedInOrders || isUsedInProducts || isUsedInActions) {
        showToast('Zákazníka nelze smazat, protože má přiřazené objednávky, produkty nebo akce.', 'error');
        return;
    }

    showConfirmation('Opravdu chcete smazat tohoto zákazníka?', () => {
        appState.zakaznici = appState.zakaznici.filter(c => c.id !== customerId);
        delete appState.boxWeights[customerId];
        saveState();
        renderCustomers();
        showToast('Zákazník smazán.', 'success');
    });
}