
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState } from './state.ts';
import { DOMElements } from './ui.ts';
import { bindGlobalEvents } from './eventHandler.ts';
import { initEmployeesApp } from './components/employees.ts';
import { getWeekNumber, minutesToTimeString } from './utils.ts';
import { calculateTimeline } from './services/calculations.ts';

// View Renderers
import { renderMainPage } from './components/mainPage.ts';
import { renderDailyPlan } from './components/dailyPlan.ts';
import { renderOrders } from './components/orders.ts';
import { renderCalendar } from './components/calendar.ts';
import { renderKFC, renderKfcProductsPage } from './components/kfc.ts';
import { renderChanges } from './components/changes.ts';
import { renderSpizySettings } from './components/spizy.ts';
import { renderCalculator } from './components/calculator.ts';
import { renderProductionOverview } from './components/productionOverview.ts';
import { renderRawMaterialOrders } from './components/rawMaterialOrders.ts';
import { renderQrCodePage } from './components/qrCode.ts';
import { renderCreateProduct } from './settings/products.ts';
import { renderCreateMix } from './settings/mixes.ts';
import { renderBoxWeights } from './settings/boxWeights.ts';
import { renderPaletteWeights } from './settings/paletteWeights.ts';
import { renderCustomers } from './settings/customers.ts';
import { renderLineSettings } from './settings/lineSettings.ts';
import { renderExportData } from './components/export.ts';
import { renderMonthlyOverview } from './components/monthlyOverview.ts';
import { renderStockBoxes, renderStockTrays } from './components/stock.ts';
import { renderFrozenProductsPage } from './components/frozenProducts.ts';


async function loadView(viewName) {
    if (typeof window !== 'undefined' && window.EMBEDDED_VIEWS) {
        const fileName = viewName + '.html';
        if (window.EMBEDDED_VIEWS[fileName]) {
            return window.EMBEDDED_VIEWS[fileName];
        }
        return `<div class="card"><div class="card-content"><p class="shortage">Error: View '${viewName}' not found.</p></div></div>`;
    }
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error(`Could not load view: ${viewName}`);
        return await response.text();
    } catch (error) {
        console.error(error);
        return `<div class="card"><div class="card-content"><p class="shortage">Error: View '${viewName}' could not be loaded.</p></div></div>`;
    }
}

export function updateInfoBar() {
    const infoBar = document.getElementById('info-bar');
    if (!infoBar) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const selectedDate = appState.ui.selectedDate;

    const weekNum = getWeekNumber(new Date(selectedDate));
    const { timeline } = calculateTimeline(selectedDate);
    
    let endTimeString = 'N/A';
    if (timeline.length > 0) {
        const lastEvent = timeline[timeline.length - 1];
        endTimeString = minutesToTimeString(lastEvent.endTime);
    }

    let currentFlockHtml = '<strong>N/A</strong>';
    let nextFlockHtml = '<strong>Žádný další</strong>';

    if (selectedDate === todayStr) {
        if (timeline.length > 0) {
            const nowInMinutes = new Date().getHours() * 60 + new Date().getMinutes();
            const currentFlockItem = timeline.find(item => item.type === 'flock' && nowInMinutes >= item.startTime && nowInMinutes < item.endTime);
            const nextFlockItem = timeline.find(item => item.type === 'flock' && item.startTime > nowInMinutes);

            if (currentFlockItem) {
                currentFlockHtml = `<strong>${currentFlockItem.name}</strong> (${currentFlockItem.avgWeight.toFixed(2)} kg)`;
            }
            if (nextFlockItem) {
                nextFlockHtml = `<strong>${nextFlockItem.name}</strong> (${nextFlockItem.avgWeight.toFixed(2)} kg)`;
            }
        }
    }

    infoBar.innerHTML = `
        <div class="info-bar-item">
            <i data-feather="calendar"></i> Týden: <strong>${weekNum}</strong>
        </div>
        <div class="info-bar-item">
            <i data-feather="clock"></i> Konec linky: <strong>${endTimeString}</strong>
        </div>
        <div class="info-bar-item">
            <i data-feather="git-commit"></i> Aktuální chov: ${currentFlockHtml}
        </div>
        <div class="info-bar-item">
            <i data-feather="chevrons-right"></i> Další chov: ${nextFlockHtml}
        </div>
    `;

    feather.replace();
}

export function startClock() {
    const clockElement = document.getElementById('digital-clock');
    if (!clockElement) return;

    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        clockElement.textContent = timeString;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

export function bindEvents() {
    DOMElements.selectedDateInput.addEventListener('change', (e) => {
        appState.ui.selectedDate = e.target.value;
        render();
    });
    bindGlobalEvents();
}

export function changeDate(days) {
    // Parse the date manually to avoid timezone issues with 'T00:00:00'
    const parts = appState.ui.selectedDate.split('-').map(Number);
    // Create a date object set to Noon (12:00) local time. 
    // This prevents Daylight Saving Time shifts from skipping a day or repeating a day when adding 24 hours.
    const currentDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    
    currentDate.setDate(currentDate.getDate() + days);
    
    appState.ui.selectedDate = currentDate.toISOString().split('T')[0];
    render();
}

function updateNavigationPermissions() {
    const role = sessionStorage.getItem('dzControlRole');
    const settingsLink = document.querySelector('a[data-view="settings-hub"]');
    const exportLink = document.querySelector('a[data-view="export-data"]');
    
    if (role === 'restricted') {
        if(settingsLink) settingsLink.style.display = 'none';
        if(exportLink) exportLink.style.display = 'none';
    } else {
        if(settingsLink) settingsLink.style.display = 'flex';
        if(exportLink) exportLink.style.display = 'flex';
    }
}

export async function render() {
    updateNavigationPermissions();
    
    DOMElements.selectedDateInput.value = appState.ui.selectedDate;
    updateInfoBar();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Update active nav link
    DOMElements.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.view === appState.ui.activeView);
        const detailsParent = link.closest('details');
        if (detailsParent && link.classList.contains('active')) {
            detailsParent.open = true;
        }
    });

    const viewName = appState.ui.activeView;
    const viewHtml = await loadView(viewName);
    DOMElements.appMain.innerHTML = viewHtml;

    switch (viewName) {
        case 'main-page': renderMainPage(); break;
        case 'daily-plan': renderDailyPlan(); break;
        case 'orders': renderOrders(); break;
        case 'calendar': renderCalendar(); break;
        case 'kfc': renderKFC(); break;
        case 'zmeny': renderChanges(); break;
        case 'calculator': renderCalculator(); break;
        case 'production-overview': renderProductionOverview(); break;
        case 'raw-material-orders': renderRawMaterialOrders(); break;
        case 'qr-code': renderQrCodePage(); break;
        case 'export-data': renderExportData(); break;
        case 'monthly-overview': renderMonthlyOverview(); break;
        case 'stock-boxes': renderStockBoxes(); break;
        case 'stock-trays': renderStockTrays(); break;
        case 'employees': initEmployeesApp(); break;
        // Settings views
        case 'customers': renderCustomers(); break;
        case 'create-product': renderCreateProduct(); break;
        case 'create-mix': renderCreateMix(); break;
        case 'frozen-products': renderFrozenProductsPage(); break;
        case 'box-weights': renderBoxWeights(); break;
        case 'palette-weights': renderPaletteWeights(); break;
        case 'spizy-settings': renderSpizySettings(); break;
        case 'kfc-products': renderKfcProductsPage(); break;
        case 'line-settings': renderLineSettings(); break;
    }

    feather.replace();
}

function checkShortages() {
    const date = appState.ui.selectedDate;
    const today = new Date().toISOString().split('T')[0];

    // Only show notifications for the current day's plan
    if (date !== today) {
        const trayNotif = document.getElementById('tray-shortage-notification');
        if (trayNotif) trayNotif.style.display = 'none';
        const chickenNotif = document.getElementById('chicken-shortage-notification');
        if (chickenNotif) chickenNotif.style.display = 'none';
        return;
    }
    
    // 1. Tray Shortage Check
    if (!appState.ui.trayNotificationDismissed) {
        const trayNeeds = new Map(appState.trayTypes.map(tt => [tt.id, 0]));
        const defaultTrayTypeId = appState.trayTypes[0]?.id;

        appState.orders
            .filter(o => o.date === date)
            .forEach(order => {
                order.items.forEach(item => {
                    if (item.isActive && item.doneCount < item.boxCount && (item.type === 'OA' || item.type === 'RB')) {
                        const trayTypeId = appState.customerTrayAssignments[order.customerId]?.[item.surovinaId] || defaultTrayTypeId;
                        if (trayNeeds.has(trayTypeId)) {
                            const count = (item.boxCount || 0) - (item.doneCount || 0);
                            trayNeeds.set(trayTypeId, trayNeeds.get(trayTypeId) + count);
                        }
                    }
                });
            });

        const shortages = [];
        appState.trayTypes.forEach(trayType => {
            const needed = trayNeeds.get(trayType.id) || 0;
            if (needed > 0) {
                const stockPallets = appState.trayStock[trayType.id] || 0;
                const piecesPerPallet = appState.trayPalletSettings[trayType.id] || 5000;
                const stockPieces = stockPallets * piecesPerPallet;
                if (stockPieces < needed) {
                    shortages.push({ name: trayType.name, needed, stock: stockPieces });
                }
            }
        });

        const notification = document.getElementById('tray-shortage-notification');
        const list = document.getElementById('tray-shortage-list');
        if (notification && list) {
            if (shortages.length > 0) {
                list.innerHTML = shortages.map(s => `<li>${s.name}: Chybí ${(s.needed - s.stock).toLocaleString('cs-CZ')} ks</li>`).join('');
                notification.style.display = 'block';
            } else {
                notification.style.display = 'none';
            }
        }
    }

    // 2. Line Plan notification check
    const { timeline } = calculateTimeline(date);
    const notification = document.getElementById('chicken-shortage-notification');
    const textEl = document.getElementById('chicken-shortage-text');

    if (!notification || !textEl) return;

    if (timeline.length > 0) {
        const lastEvent = timeline[timeline.length - 1];
        const endTimeInMinutes = lastEvent.endTime;
        
        if (endTimeInMinutes > 14.5 * 60) { // After 14:30
            const chickenNotificationInfo = appState.ui.chickenNotificationInfo || { lastCheckedDate: null, count: 0 };
            
            const totalChickens = timeline.reduce((sum, item) => sum + (item.type === 'flock' ? item.count : 0), 0);
            
            if (chickenNotificationInfo.lastCheckedDate !== date || chickenNotificationInfo.count !== totalChickens) {
                const endTimeString = minutesToTimeString(endTimeInMinutes);
                textEl.textContent = `Předpokládaný konec linky je v ${endTimeString}. Linka pojede déle než do 14:30.`;
                notification.style.display = 'block';
                appState.ui.chickenNotificationInfo = { lastCheckedDate: date, count: totalChickens };
            }
        } else {
            notification.style.display = 'none';
        }
    } else {
        notification.style.display = 'none';
    }
}


export function initializeNotificationInterval() {
    setInterval(checkShortages, 30000); // Check every 30 seconds
}
