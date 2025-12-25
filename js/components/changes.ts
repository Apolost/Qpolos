/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showConfirmation, showToast } from '../ui.ts';
import { generateId } from '../utils.ts';

export function renderChanges() {
    // RENDER GENERAL CHANGES
    const tbody = document.getElementById('changes-table-body');
    tbody.innerHTML = '';
    appState.changes.forEach(change => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(change.dateFrom).toLocaleDateString('cs-CZ')}</td>
            <td>${change.dateTo ? new Date(change.dateTo).toLocaleDateString('cs-CZ') : '-'}</td>
            <td>${change.title}</td>
            <td>${change.text}</td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-change" data-id="${change.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-change" data-id="${change.id}">${ICONS.trash}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // RENDER PRICE CHANGES
    const priceTbody = document.getElementById('price-changes-table-body');
    if (!priceTbody) return;
    priceTbody.innerHTML = '';
    appState.priceChanges.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom)).forEach(change => {
        const customer = appState.zakaznici.find(c => c.id === change.customerId);
        const surovina = appState.suroviny.find(s => s.id === change.surovinaId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${customer?.name || 'N/A'}</td>
            <td>${surovina?.name || 'N/A'}</td>
            <td>${new Date(change.validFrom).toLocaleDateString('cs-CZ')}</td>
            <td>${(change.price || 0).toFixed(2)} Kč</td>
            <td class="actions">
                <button class="btn-icon" data-action="edit-price-change" data-id="${change.id}">${ICONS.edit}</button>
                <button class="btn-icon danger" data-action="delete-price-change" data-id="${change.id}">${ICONS.trash}</button>
            </td>
        `;
        priceTbody.appendChild(tr);
    });
    feather.replace();
}

export function openAddChangeModal(changeId = null) {
    const modal = DOMElements.addChangeModal;
    const { addChangeModalTitle, changeDateFrom, changeDateTo, changeTitle, changeText } = {
        addChangeModalTitle: modal.querySelector('.modal-title'),
        changeDateFrom: modal.querySelector('#change-date-from'),
        changeDateTo: modal.querySelector('#change-date-to'),
        changeTitle: modal.querySelector('#change-title'),
        changeText: modal.querySelector('#change-text'),
    };

    appState.ui.editingChangeId = changeId;

    if (changeId) {
        const change = appState.changes.find(c => c.id === changeId);
        if (change) {
            addChangeModalTitle.textContent = "Upravit změnu";
            changeDateFrom.value = change.dateFrom;
            changeDateTo.value = change.dateTo || '';
            changeTitle.value = change.title;
            changeText.value = change.text;
        }
    } else {
        addChangeModalTitle.textContent = "Přidat změnu";
        changeDateFrom.value = new Date().toISOString().split('T')[0];
        changeDateTo.value = '';
        changeTitle.value = '';
        changeText.value = '';
    }
    modal.classList.add('active');
}

export function saveChange() {
    const modal = DOMElements.addChangeModal;
    const changeDateFrom = modal.querySelector('#change-date-from');
    const changeDateTo = modal.querySelector('#change-date-to');
    const changeTitle = modal.querySelector('#change-title');
    const changeText = modal.querySelector('#change-text');
    
    const title = changeTitle.value.trim();
    const text = changeText.value.trim();
    const dateFrom = changeDateFrom.value;
    const dateTo = changeDateTo.value;

    if (!title || !dateFrom) {
        showToast('Datum "od" a nadpis jsou povinné.', 'error');
        return;
    }

    if (appState.ui.editingChangeId) {
        const change = appState.changes.find(c => c.id === appState.ui.editingChangeId);
        if (change) {
            change.dateFrom = dateFrom;
            change.dateTo = dateTo;
            change.title = title;
            change.text = text;
            showToast('Změna upravena');
        }
    } else {
        appState.changes.push({ id: generateId(), dateFrom, dateTo, title, text });
        showToast('Změna uložena');
    }
    
    saveState();
    renderChanges();
    modal.classList.remove('active');
}

export function deleteChange(changeId) {
    showConfirmation('Opravdu chcete smazat tuto změnu?', () => {
        appState.changes = appState.changes.filter(c => c.id !== changeId);
        saveState();
        renderChanges();
        showToast('Změna smazána', 'success');
    });
}

export function openPriceChangeModal(changeId = null) {
    const modal = DOMElements.priceChangeModal;
    const customerSelect = modal.querySelector('#price-change-customer');
    const surovinaSelect = modal.querySelector('#price-change-surovina');
    const dateInput = modal.querySelector('#price-change-date');
    const priceInput = modal.querySelector('#price-change-price');
    const title = modal.querySelector('.modal-title');

    customerSelect.innerHTML = appState.zakaznici.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    surovinaSelect.innerHTML = appState.suroviny.filter(s => s.isActive).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    appState.ui.editingPriceChangeId = changeId;

    if (changeId) {
        const change = appState.priceChanges.find(c => c.id === changeId);
        if (change) {
            title.textContent = 'Upravit změnu ceny';
            customerSelect.value = change.customerId;
            surovinaSelect.value = change.surovinaId;
            dateInput.value = change.validFrom;
            priceInput.value = change.price;
        }
    } else {
        title.textContent = 'Nová změna ceny';
        dateInput.value = new Date().toISOString().split('T')[0];
        priceInput.value = '';
    }
    
    modal.classList.add('active');
}

export function savePriceChange() {
    const modal = DOMElements.priceChangeModal;
    const customerId = modal.querySelector('#price-change-customer').value;
    const surovinaId = modal.querySelector('#price-change-surovina').value;
    const validFrom = modal.querySelector('#price-change-date').value;
    const price = parseFloat(modal.querySelector('#price-change-price').value);

    if (!customerId || !surovinaId || !validFrom || isNaN(price)) {
        showToast('Všechna pole jsou povinná a cena musí být číslo.', 'error');
        return;
    }

    if (appState.ui.editingPriceChangeId) {
        const change = appState.priceChanges.find(c => c.id === appState.ui.editingPriceChangeId);
        if (change) {
            change.customerId = customerId;
            change.surovinaId = surovinaId;
            change.validFrom = validFrom;
            change.price = price;
            showToast('Změna ceny byla upravena.');
        }
    } else {
        const newPriceChange = {
            id: generateId(),
            customerId,
            surovinaId,
            validFrom,
            price,
        };
        appState.priceChanges.push(newPriceChange);
        showToast('Změna ceny byla uložena.');
    }
    
    appState.ui.editingPriceChangeId = null;
    saveState();
    renderChanges();
    modal.classList.remove('active');
}

export function deletePriceChange(changeId) {
    showConfirmation('Opravdu chcete smazat tuto změnu ceny?', () => {
        appState.priceChanges = appState.priceChanges.filter(c => c.id !== changeId);
        saveState();
        renderChanges();
        showToast('Změna ceny smazána.', 'success');
    });
}