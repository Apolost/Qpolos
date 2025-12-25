/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { getDailyNeeds, calculateYieldData, calculateTimeline } from '../services/calculations.ts';
import { handleThighSplitProduction } from '../services/production.ts';

export function renderDailyPlan() {
    const date = appState.ui.selectedDate;
    
    // --- Calculations ---
    const { totals } = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];
    const { yieldData, thighNeeds } = calculateYieldData(date, dailyData?.flocks, totals.totalWeight);
    
    const todayNeeds = getDailyNeeds(date, 'non-kfc');
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const tomorrowNeeds = getDailyNeeds(nextDay.toISOString().split('T')[0], 'non-kfc');

    const tbody = document.querySelector('#suroviny-overview-table tbody');
    tbody.innerHTML = '';

    const surovinyToDisplay = appState.suroviny.filter(s => s.isActive && !s.isMix && !s.isProduct);

    // --- Pre-calculate complex group balances ---
    const thighSurovinaNames = ['STEHNA', 'HORNÍ STEHNA', 'SPODNÍ STEHNA', 'ČTVRTKY'];
    let finalThighBalanceKg = 0;
    
    // Only calculate thigh balance if there is production, otherwise it can be misleading
    if (yieldData.length > 0 || Object.values(todayNeeds).some(n => n > 0)) {
        const allThighSuroviny = appState.suroviny.filter(ts => ts.isActive && thighSurovinaNames.includes(ts.name.toUpperCase()));
        let totalThighStockKg = 0;
        allThighSuroviny.forEach(ts => {
            const b = appState.dailyStockAdjustments[date]?.[ts.id] || 0;
            totalThighStockKg += (ts.stock || 0) * (ts.paletteWeight || 0) + b * (ts.boxWeight || 25);
        });
        const totalThighProductionKg = yieldData.find(y => y.name.toUpperCase() === 'STEHNA CELKEM')?.produced || 0;
        const totalThighNeededKg = Object.values(thighNeeds).reduce((sum, val) => sum + val, 0);
        finalThighBalanceKg = totalThighStockKg + totalThighProductionKg - totalThighNeededKg;
    }


    surovinyToDisplay.forEach(s => {
        const surovinaNameUpper = s.name.toUpperCase();
        
        // --- Get Stock ---
        const stockPallets = s.stock || 0;
        const stockBoxes = appState.dailyStockAdjustments[date]?.[s.id] || 0;
        const stockFromStorageKg = stockPallets * (s.paletteWeight || 0) + stockBoxes * (s.boxWeight || 25);
        
        // --- Get Production ---
        const yieldItem = yieldData.find(y => y.name.toUpperCase().replace(' (SKELETY)', '') === surovinaNameUpper.replace(' (SKELETY)', ''));
        const productionKg = yieldItem ? yieldItem.produced : 0;
        
        // --- Get Total Available & Needed ---
        const totalAvailableKg = stockFromStorageKg + productionKg;
        const neededKg = todayNeeds[s.id] || 0;
        
        // --- Calculate Balance ---
        let balancePalettes = 0;
        if (s.paletteWeight > 0) {
            if (thighSurovinaNames.includes(surovinaNameUpper)) {
                // For all thigh types, display the same overall group balance
                balancePalettes = finalThighBalanceKg / (s.paletteWeight || 500);
            } else {
                 balancePalettes = (totalAvailableKg - neededKg) / s.paletteWeight;
            }
        }
        
        let balanceHtml = '';
        if (balancePalettes < -0.01) {
            balanceHtml = `<span class="shortage">${balancePalettes.toFixed(2)}</span>`;
        } else {
            balanceHtml = `<span class="surplus">+${balancePalettes.toFixed(2)}</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name}</td>
            <td><input type="number" value="${stockPallets}" data-surovina-id="${s.id}" class="stock-input" style="width: 80px;"></td>
            <td><input type="number" value="${stockBoxes || ''}" data-surovina-id="${s.id}" class="box-input" style="width: 80px;" placeholder="0"></td>
            <td>${stockFromStorageKg.toFixed(2)} kg</td>
            <td>${productionKg.toFixed(2)} kg</td>
            <td><strong>${totalAvailableKg.toFixed(2)} kg</strong></td>
            <td>${neededKg.toFixed(2)} kg</td>
            <td>${balanceHtml}</td>
            <td>${(tomorrowNeeds[s.id] || 0).toFixed(2)} kg</td>
        `;
        tbody.appendChild(tr);
    });


    tbody.querySelectorAll('.stock-input').forEach(input => {
        input.addEventListener('change', e => {
            const surovina = appState.suroviny.find(s => s.id === e.target.dataset.surovinaId);
            if (surovina) surovina.stock = parseFloat(e.target.value) || 0;
            saveState();
            renderDailyPlan();
        });
    });

    tbody.querySelectorAll('.box-input').forEach(input => {
        input.addEventListener('change', e => {
            const surovinaId = e.target.dataset.surovinaId;
            const date = appState.ui.selectedDate;

            if (!appState.dailyStockAdjustments[date]) {
                appState.dailyStockAdjustments[date] = {};
            }
            const oldValue = appState.dailyStockAdjustments[date][surovinaId] || 0;
            const newValue = parseFloat(e.target.value) || 0;

            appState.dailyStockAdjustments[date][surovinaId] = newValue;

            if (newValue > oldValue) {
                const addedBoxes = newValue - oldValue;
                handleThighSplitProduction(surovinaId, addedBoxes, date);
            }

            saveState();
            renderDailyPlan();
        });
    });

    renderKalibrTable();
}

function renderKalibrTable() {
    document.getElementById('kalibr-table-container').innerHTML = '<p>Zde bude tabulka kalibrace.</p>';
}