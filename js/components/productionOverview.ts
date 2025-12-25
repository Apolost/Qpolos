/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck
import { appState, saveState } from '../state.ts';
import { DOMElements, ICONS, showToast, showConfirmation } from '../ui.ts';
import { getDailyNeeds, getMaykawaThighsNeeded, getKfcSurovinyNeeds, getSpizyNeeds, calculateYieldData, calculateTimeline } from '../services/calculations.ts';
import { minutesToTimeString } from '../utils.ts';

let partsChart = null;
let rizkyChart = null;

/**
 * Updates the displayed weight range for a flock based on average weight and deviation.
 * @param {HTMLElement} rowElement - The flock row element in the modal.
 */
function updateFlockRange(rowElement) {
    const weightInput = rowElement.querySelector('.chicken-flock-weight');
    const deviationInput = rowElement.querySelector('.chicken-flock-deviation');
    const rangeEl = rowElement.querySelector('.chicken-flock-range');

    const avgWeight = parseFloat(weightInput.value);
    const deviation = parseFloat(deviationInput.value);

    if (!isNaN(avgWeight) && avgWeight > 0 && !isNaN(deviation) && deviation >= 0) {
        const minWeight = avgWeight * (1 - deviation / 100);
        const maxWeight = avgWeight * (1 + deviation / 100);
        rangeEl.textContent = `Rozsah: ${minWeight.toFixed(3)} - ${maxWeight.toFixed(3)} kg`;
    } else {
        rangeEl.textContent = '';
    }
}

export function renderProductionOverview() {
    const timelineContainer = document.getElementById('production-timeline-container');
    const summaryContainer = document.getElementById('production-summary-container');
    if (!timelineContainer || !summaryContainer) return;

    const date = appState.ui.selectedDate;
    const { timeline, totals } = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];

    if (!appState.ui.partsChartType) {
        appState.ui.partsChartType = 'yield';
    }
    
    if (timeline.length === 0) {
        timelineContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Pro tento den nebyly zadány žádné kuřata. Začněte kliknutím na "Denní naskladnění kuřat".</p>';
        summaryContainer.innerHTML = '';
        renderYieldOverview(date, null, 0);
        renderRizkyOverview('day');
        return;
    }
    
    // Render Timeline
    let timelineHtml = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Čas od</th>
                    <th>Čas do</th>
                    <th>Délka</th>
                    <th>Popis</th>
                    <th>Detail</th>
                    <th class="actions">Akce</th>
                </tr>
            </thead>
            <tbody>
    `;

    timeline.forEach(item => {
        const duration = item.endTime - item.startTime;
        const durationStr = `${Math.floor(duration / 60)}h ${Math.round(duration % 60)}m`;
        let description = '';
        let detail = '';
        let actions = '';
        let rowClass = '';

        if (item.type === 'flock') {
            description = `<strong>Chov: ${item.name}</strong>`;
            detail = `${item.count.toLocaleString('cs-CZ')} ks, Ø ${item.avgWeight.toFixed(2)} kg`;
            actions = `
                <button class="btn-icon danger" data-action="delete-production-flock" data-index="${item.originalIndex}" title="Smazat">${ICONS.trash}</button>
            `;
        } else if (item.type === 'pause') {
            description = `Pauza`;
            rowClass = 'done';
            if (!item.isAutomatic) { // Only allow deleting manual pauses
                actions = `<button class="btn-icon danger" data-action="delete-production-event" data-id="${item.id}">${ICONS.trash}</button>`;
            }
        } else if (item.type === 'breakdown') {
            description = `Porucha`;
            rowClass = 'shortage';
            actions = `<button class="btn-icon danger" data-action="delete-production-event" data-id="${item.id}">${ICONS.trash}</button>`;
        }
        
        timelineHtml += `
            <tr class="${rowClass}">
                <td>${minutesToTimeString(item.startTime)}</td>
                <td>${minutesToTimeString(item.endTime)}</td>
                <td>${durationStr}</td>
                <td>${description}</td>
                <td>${detail}</td>
                <td class="actions">${actions}</td>
            </tr>
        `;
    });

    timelineHtml += '</tbody></table>';
    timelineContainer.innerHTML = timelineHtml;

    // Render Summary
    const totalHours = Math.floor(totals.totalTime / 60);
    const totalMinutes = Math.round(totals.totalTime % 60);
    const totalTimeString = `${totalHours} hod ${totalMinutes} min`;

    const lastEvent = timeline[timeline.length - 1];
    const endTimeString = minutesToTimeString(lastEvent.endTime);
    
    summaryContainer.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Celkem kuřat (ks)</th>
                    <th>Celková váha (kg)</th>
                    <th>Celkový čas linky</th>
                    <th>Předpokládaný konec</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>${totals.totalChickens.toLocaleString('cs-CZ')} ks</strong></td>
                    <td><strong>${totals.totalWeight.toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg</strong></td>
                    <td style="color: var(--accent-primary); font-weight: bold;">${totalTimeString}</td>
                    <td style="color: var(--accent-danger); font-weight: bold;">${endTimeString}</td>
                </tr>
            </tbody>
        </table>
    `;
    
    renderYieldOverview(date, dailyData?.flocks, totals.totalWeight);
    renderRizkyOverview('day');

    document.querySelectorAll('#parts-chart-controls .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            appState.ui.partsChartType = e.currentTarget.dataset.view;
            document.querySelectorAll('#parts-chart-controls .btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderPartsChart();
        });
    });

    // Set active button based on state
    document.querySelectorAll('#parts-chart-controls .btn').forEach(b => b.classList.remove('active'));
    const activeButton = document.querySelector(`#parts-chart-controls .btn[data-view="${appState.ui.partsChartType}"]`);
    if(activeButton) activeButton.classList.add('active');


    renderPartsChart();

    feather.replace();
}

function renderYieldOverview(date, flocks, totalWeight) {
    const container = document.getElementById('production-yield-container');
    if (!container) return;
    
    const { yieldData, thighNeeds } = calculateYieldData(date, flocks, totalWeight);
    
    if (yieldData.length === 0) {
        container.innerHTML = '<p style="text-align: center;">Nejsou naskladněná žádná kuřata pro výpočet výtěžnosti.</p>';
        return;
    }

    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Část</th>
                    <th>Skladem (kg)</th>
                    <th>Z výroby (kg)</th>
                    <th>Celkem k dispozici (kg)</th>
                    <th>Celková potřeba (kg)</th>
                    <th>Rozdíl (kg)</th>
                    <th>Rozdíl (palety)</th>
                </tr>
            </thead>
            <tbody>
    `;

    yieldData.forEach(data => {
        const surovina = appState.suroviny.find(s => s.name.toUpperCase().replace(' (SKELETY)', '') === data.name.toUpperCase().replace(' (SKELETY)', ''));

        let stockKg = 0;
        if (data.name === 'Stehna celkem') {
            const thighSurovinaNames = ['STEHNA', 'HORNÍ STEHNA', 'SPODNÍ STEHNA', 'ČTVRTKY'];
            const thighSuroviny = appState.suroviny.filter(s => thighSurovinaNames.includes(s.name.toUpperCase()));
            stockKg = 0;
            thighSuroviny.forEach(s => {
                const boxes = appState.dailyStockAdjustments[date]?.[s.id] || 0;
                stockKg += (s.stock || 0) * (s.paletteWeight || 0) + boxes * (s.boxWeight || 25);
            });
        } else if (surovina) {
            const boxes = appState.dailyStockAdjustments[date]?.[surovina.id] || 0;
            const boxWeight = surovina.boxWeight || 25;
            stockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + boxes * boxWeight;
        }

        const totalAvailable = stockKg + data.produced;
        const finalDifference = totalAvailable - data.needed;
        const paletteWeight = data.paletteWeight || surovina?.paletteWeight || 0;
        const differencePallets = paletteWeight > 0 ? (finalDifference / paletteWeight).toFixed(2) : 'N/A';
        const diffClass = finalDifference < -0.01 ? 'shortage' : finalDifference > 0.01 ? 'surplus' : '';
        const isTotalRow = data.name.includes('celkem');
        const rowStyle = isTotalRow ? 'font-weight: bold; background-color: var(--bg-tertiary);' : '';
        
        tableHTML += `
            <tr style="${rowStyle}">
                <td>${data.name}</td>
                <td>${stockKg.toFixed(2)}</td>
                <td>${data.produced.toFixed(2)}</td>
                <td><strong>${totalAvailable.toFixed(2)}</strong></td>
                <td>${data.needed.toFixed(2)}</td>
                <td class="${diffClass}">${finalDifference.toFixed(2)}</td>
                <td class="${diffClass}">${differencePallets}</td>
            </tr>
        `;

        if (data.name === 'Prsa' && data.prsaNeededForRizky > 0) {
            const prsaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'PRSA');
            const palletsForRizky = (prsaSurovina && prsaSurovina.paletteWeight > 0) ? (data.prsaNeededForRizky / prsaSurovina.paletteWeight).toFixed(2) : 'N/A';
            tableHTML += `
                <tr style="font-size: 0.9em; color: var(--text-secondary);">
                    <td style="padding-left: 25px;">↳ z toho na řízky</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>${data.prsaNeededForRizky.toFixed(2)}</td>
                    <td colspan="2" style="font-weight: bold;">(cca ${palletsForRizky} palet)</td>
                </tr>
            `;
        }
        
        if (data.name === 'Prsa' && finalDifference > 0.01) {
            const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
            if (rizkySurovina) {
                const potentialRizkyKg = finalDifference * 0.70;
                const paletteWeight = rizkySurovina.paletteWeight || 0;
                const potentialRizkyPalettes = paletteWeight > 0 ? (potentialRizkyKg / paletteWeight) : 0;

                tableHTML += `
                    <tr style="font-size: 0.9em; color: var(--accent-primary);">
                        <td style="padding-left: 25px;">
                            <i data-feather="arrow-right-circle" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px;"></i>
                            z přebytku lze vyrobit řízky
                        </td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="surplus" style="font-weight: bold;">${potentialRizkyKg.toFixed(2)}</td>
                        <td class="surplus" style="font-weight: bold;">${potentialRizkyPalettes.toFixed(2)}</td>
                    </tr>
                `;
            }
        }

        if (data.name === 'Stehna celkem' && Object.keys(thighNeeds).length > 0) {
            for (const partName in thighNeeds) {
                 tableHTML += `
                    <tr style="font-size: 0.9em; color: var(--text-secondary);">
                        <td style="padding-left: 25px;">↳ ${partName}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>${thighNeeds[partName].toFixed(2)}</td>
                        <td colspan="2">-</td>
                    </tr>
                `;
            }
        }
    });
    
    const dailyNeeds = getDailyNeeds(date);
    const steakSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEAK');
    if (steakSurovina && dailyNeeds[steakSurovina.id] > 0) {
        const totalThighsNeededKg = getMaykawaThighsNeeded(date);
        const { maykawaConfig } = appState;
        const bonesProduced = totalThighsNeededKg * ((maykawaConfig.bonePercent || 0) / 100);
        const skinProduced = totalThighsNeededKg * ((maykawaConfig.skinPercent || 0) / 100);
        tableHTML += `<tr style="background-color: var(--bg-tertiary);"><td>Kosti (z Maykawa)</td><td>-</td><td>${bonesProduced.toFixed(2)}</td><td>${bonesProduced.toFixed(2)}</td><td>-</td><td colspan="2">-</td></tr>`;
        tableHTML += `<tr style="background-color: var(--bg-tertiary);"><td>Kůže (z Maykawa)</td><td>-</td><td>${skinProduced.toFixed(2)}</td><td>${skinProduced.toFixed(2)}</td><td>-</td><td colspan="2">-</td></tr>`;
    }

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
    feather.replace();
}

function renderPartsChart() {
    const canvas = document.getElementById('parts-overview-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (partsChart) {
        partsChart.destroy();
    }
    
    const date = appState.ui.selectedDate;
    const { timeline, totals } = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];

    let chartConfig = {};
    const chartType = appState.ui.partsChartType || 'yield';

    switch (chartType) {
        case 'yield': {
            const { yieldData } = calculateYieldData(date, dailyData?.flocks, totals.totalWeight);
            if (yieldData.length === 0) return;
            chartConfig = {
                type: 'bar',
                data: {
                    labels: yieldData.map(d => d.name),
                    datasets: [
                        { label: 'Vyprodukováno (kg)', data: yieldData.map(d => d.produced), backgroundColor: 'rgba(54, 162, 235, 0.6)' },
                        { label: 'Potřeba z obj. (kg)', data: yieldData.map(d => d.needed), backgroundColor: 'rgba(201, 203, 207, 0.6)' },
                        { label: 'Rozdíl (kg)', data: yieldData.map(d => d.difference), backgroundColor: (c) => c.raw >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)' }
                    ]
                }
            };
            break;
        }
        case 'rizky-prsa': {
            const { yieldData } = calculateYieldData(date, dailyData?.flocks, totals.totalWeight);
            const dailyNeeds = getDailyNeeds(date);

            const prsaSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'PRSA');
            const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');

            const prsaYield = yieldData.find(d => d.name === 'Prsa')?.produced || 0;
            const prsaStock = (prsaSurovina.stock || 0) * (prsaSurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[prsaSurovina.id] || 0) * (prsaSurovina.boxWeight || 25);
            const prsaAvailable = prsaYield + prsaStock;
            
            const prsaNeededDirect = dailyNeeds[prsaSurovina.id] || 0;
            const rizkyNeeded = dailyNeeds[rizkySurovina.id] || 0;
            const prsaNeededForRizky = rizkyNeeded > 0 ? rizkyNeeded / 0.70 : 0;
            const prsaTotalNeeded = prsaNeededDirect + prsaNeededForRizky;
            const prsaSurplus = prsaAvailable - prsaTotalNeeded;
            
            const rizkyStock = (rizkySurovina.stock || 0) * (rizkySurovina.paletteWeight || 0) + (appState.dailyStockAdjustments[date]?.[rizkySurovina.id] || 0) * (rizkySurovina.boxWeight || 25);
            const rizkyAvailableFromProd = Math.max(0, prsaSurplus) * 0.70;
            const rizkyTotalAvailable = rizkyStock + rizkyAvailableFromProd;
            const rizkySurplus = rizkyTotalAvailable - rizkyNeeded;
            
            chartConfig = {
                type: 'bar',
                data: {
                    labels: ['Prsa', 'Řízky'],
                    datasets: [
                        { label: 'Dostupné (kg)', data: [prsaAvailable, rizkyTotalAvailable], backgroundColor: 'rgba(54, 162, 235, 0.6)' },
                        { label: 'Potřeba (kg)', data: [prsaTotalNeeded, rizkyNeeded], backgroundColor: 'rgba(201, 203, 207, 0.6)' },
                        { label: 'Zůstatek (kg)', data: [prsaSurplus, rizkySurplus], backgroundColor: (c) => c.raw >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)' }
                    ]
                }
            };
            break;
        }
        case 'stehna': {
            const { yieldData, thighNeeds } = calculateYieldData(date, dailyData?.flocks, totals.totalWeight);
            const thighYield = yieldData.find(d => d.name === 'Stehna celkem');
            const totalThighsSurplus = thighYield?.difference || 0;

            const datasets = [];
            const needsData = [
                thighNeeds['Na dělení (H/S)'] || 0,
                thighNeeds['Na Čtvrtky'] || 0,
                thighNeeds['STEHNA'] || 0,
                thighNeeds['Na Steak (Maykawa)'] || 0
            ];
            
            if (needsData[0] > 0) datasets.push({ label: 'Na dělení (H/S)', data: [needsData[0]], backgroundColor: 'rgba(255, 159, 64, 0.7)' }); // orange
            if (needsData[1] > 0) datasets.push({ label: 'Na Čtvrtky', data: [needsData[1]], backgroundColor: 'rgba(75, 192, 192, 0.7)' }); // teal
            if (needsData[2] > 0) datasets.push({ label: 'Na Stehna (přímé)', data: [needsData[2]], backgroundColor: 'rgba(54, 162, 235, 0.7)' }); // blue
            if (needsData[3] > 0) datasets.push({ label: 'Na Steak', data: [needsData[3]], backgroundColor: 'rgba(153, 102, 255, 0.7)' }); // purple

            if (totalThighsSurplus > 0) {
                 datasets.push({ label: 'Zůstatek', data: [totalThighsSurplus], backgroundColor: 'rgba(201, 203, 207, 0.7)' }); // grey
            } else if (totalThighsSurplus < 0) {
                 datasets.push({ label: 'Chybí', data: [Math.abs(totalThighsSurplus)], backgroundColor: 'rgba(255, 99, 132, 0.7)' }); // red
            }

            chartConfig = {
                type: 'bar',
                data: {
                    labels: ['Využití stehen'], // Single category bar
                    datasets: datasets
                },
                options: {
                    plugins: {
                        title: { display: true, text: 'Využití celkové produkce stehen' },
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) label += `${context.parsed.y.toFixed(2)} kg`;
                                    return label;
                                }
                            }
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, title: { display: true, text: 'Hmotnost (kg)' } }
                    }
                }
            };
            break;
        }
    }
    
    partsChart = new Chart(ctx, {
        ...chartConfig,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Hmotnost (kg)' }
                }
            },
            plugins: {
                legend: { position: 'top' },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    color: 'rgba(0, 0, 0, 0.7)',
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    formatter: (value) => {
                        // Only show labels for values greater than 5 to avoid clutter
                        return Math.abs(value) > 5 ? Math.round(value) : '';
                    }
                }
            },
            ...chartConfig.options // Merge specific options like stacking
        }
    });
}

function getDateRange(range, selectedDateObj) {
    const year = selectedDateObj.getFullYear();
    const month = selectedDateObj.getMonth();
    const date = selectedDateObj.getDate();

    let startDate;
    let endDate;

    switch (range) {
        case 'week':
            const dayOfWeek = selectedDateObj.getDay();
            const diff = date - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday being 0
            startDate = new Date(year, month, diff);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            break;
        case 'month':
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0);
            break;
        case 'day':
        default:
            startDate = selectedDateObj;
            endDate = selectedDateObj;
            break;
    }
    const toDateString = (d) => d.toISOString().split('T')[0];
    return { startDate: toDateString(startDate), endDate: toDateString(endDate) };
}

function calculateRizkyByCustomerForDateRange(startDate, endDate) {
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    if (!rizkySurovina) {
        console.error("Surovina 'ŘÍZKY' nebyla nalezena.");
        return [];
    }
    const customerTotals = {}; 
    const ordersInRange = appState.orders.filter(o => o.date >= startDate && o.date <= endDate);

    ordersInRange.forEach(order => {
        order.items.forEach(item => {
            if (item.surovinaId === rizkySurovina.id && item.isActive) {
                const weights = appState.boxWeights[order.customerId]?.[rizkySurovina.id];
                const boxWeightInGrams = (weights && item.type && weights[item.type]) ? weights[item.type] : 10000;
                const kg = item.boxCount * (boxWeightInGrams / 1000);
                customerTotals[order.customerId] = (customerTotals[order.customerId] || 0) + kg;
            }
        });
    });

    const chartData = Object.entries(customerTotals).map(([customerId, totalKg]) => {
        const customer = appState.zakaznici.find(c => c.id === customerId);
        return {
            customerName: customer ? customer.name : 'Neznámý',
            totalKg: totalKg
        };
    }).filter(d => d.totalKg > 0)
      .sort((a, b) => b.totalKg - a.totalKg);

    return chartData;
}

function renderRizkyChart(chartData) {
    const canvas = document.getElementById('rizky-overview-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (rizkyChart) {
        rizkyChart.destroy();
    }

    if (!chartData || chartData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'grey';
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillText('Pro vybrané období nejsou žádná data.', canvas.width / 2, canvas.height / 2);
        return;
    }

    const labels = chartData.map(d => d.customerName);
    const data = chartData.map(d => d.totalKg);

    rizkyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Celkem řízků (kg)',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Hmotnost (kg)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.parsed.y.toFixed(2)} kg`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    color: 'rgba(0, 0, 0, 0.8)',
                    font: {
                        size: 14,
                        weight: 'bold',
                    },
                    formatter: (value) => {
                        return `${Math.round(value)} kg`;
                    },
                }
            }
        }
    });
}

export function renderRizkyOverview(range = 'day') {
    document.querySelectorAll('#rizky-overview-controls .btn').forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`#rizky-overview-controls .btn[data-range="${range}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    const selectedDate = new Date(appState.ui.selectedDate + 'T12:00:00Z');
    const { startDate, endDate } = getDateRange(range, selectedDate);
    
    const chartData = calculateRizkyByCustomerForDateRange(startDate, endDate);
    renderRizkyChart(chartData);
}


export function openChickenCountModal() {
    const modal = DOMElements.chickenCountModal;
    const date = appState.ui.selectedDate;
    const dailyData = appState.chickenCounts[date];

    // Determine default start time based on day of week
    const selectedDate = new Date(date + 'T12:00:00Z'); // Use noon to avoid DST issues
    const dayOfWeek = selectedDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    let defaultStartTime = '06:00'; // Fallback for weekends
    if (dayOfWeek === 1) { // Monday
        defaultStartTime = '02:00';
    } else if (dayOfWeek >= 2 && dayOfWeek <= 5) { // Tuesday to Friday
        defaultStartTime = '03:50';
    }

    // Determine default delays
    const defaultDelayHours = 2;
    const defaultDelayMinutes = 10;
    
    // Set values: use saved data if it exists, otherwise use the new defaults
    modal.querySelector('#chicken-start-time').value = dailyData?.startTime || defaultStartTime;
    modal.querySelector('#chicken-delay-hours').value = dailyData?.delayHours !== undefined ? dailyData.delayHours : defaultDelayHours;
    modal.querySelector('#chicken-delay-minutes').value = dailyData?.delayMinutes !== undefined ? dailyData.delayMinutes : defaultDelayMinutes;
    
    const flocksContainer = modal.querySelector('#chicken-flocks-container');
    flocksContainer.innerHTML = '';

    if (dailyData && dailyData.flocks && dailyData.flocks.length > 0) {
        dailyData.flocks.forEach(flock => {
            // Ensure deviation property exists for older data
            const flockWithDeviation = { ...flock, deviation: flock.deviation || '' };
            addChickenFlockRow(flockWithDeviation);
        });
    } else {
        addChickenFlockRow(); // Add one empty row to start
    }

    modal.classList.add('active');
}

export function addChickenFlockRow(flock = { name: '', count: '', avgWeight: '', deviation: '' }) {
    const container = DOMElements.chickenCountModal.querySelector('#chicken-flocks-container');
    const newRow = document.createElement('div');
    newRow.className = 'form-row flock-row';
    newRow.style.alignItems = 'flex-end';
    newRow.style.gap = '15px';
    newRow.style.flexWrap = 'nowrap'; // Ensure it stays on one line

    newRow.innerHTML = `
        <div class="form-field" style="flex: 2; min-width: 120px;">
            <label>Název chovu</label>
            <input type="text" class="chicken-flock-name" value="${flock.name || ''}" placeholder="např. Farma XY">
        </div>
        <div class="form-field" style="flex: 1; min-width: 70px;">
            <label>Počet kuřat</label>
            <input type="number" class="chicken-flock-count" value="${flock.count || ''}" placeholder="ks">
        </div>
        <div class="form-field" style="flex: 1; min-width: 90px;">
            <label>Prům. váha (kg)</label>
            <input type="number" step="0.01" class="chicken-flock-weight" value="${flock.avgWeight || ''}" placeholder="kg">
        </div>
        <div class="form-field" style="flex: 1; min-width: 70px;">
            <label>Odchylka (%)</label>
            <input type="number" step="1" class="chicken-flock-deviation" value="${flock.deviation || ''}" placeholder="%">
        </div>
        <div class="form-field" style="flex: 2; min-width: 160px;">
             <p class="chicken-flock-range" style="font-size: 0.9rem; color: var(--text-secondary); padding-bottom: 10px; min-height: 40px; white-space: nowrap;"></p>
        </div>
        <button class="btn-icon danger" data-action="delete-chicken-flock">${ICONS.trash}</button>
    `;
    container.appendChild(newRow);

    const weightInput = newRow.querySelector('.chicken-flock-weight');
    const deviationInput = newRow.querySelector('.chicken-flock-deviation');
    
    weightInput.addEventListener('input', () => updateFlockRange(newRow));
    deviationInput.addEventListener('input', () => updateFlockRange(newRow));
    
    // Initial calculation
    updateFlockRange(newRow);

    feather.replace();
}


export function deleteChickenFlockRow(buttonElement) {
    const row = buttonElement.closest('.flock-row');
    const container = DOMElements.chickenCountModal.querySelector('#chicken-flocks-container');
    if (container.children.length > 1) {
        row.remove();
    } else {
        showToast('Nelze smazat poslední chov.', 'error');
    }
}

export function saveChickenCount() {
    const modal = DOMElements.chickenCountModal;
    const date = appState.ui.selectedDate;
    
    const startTime = modal.querySelector('#chicken-start-time').value;
    const delayHours = parseInt(modal.querySelector('#chicken-delay-hours').value) || 0;
    const delayMinutes = parseInt(modal.querySelector('#chicken-delay-minutes').value) || 0;
    const flocks = [];
    let hasError = false;
    
    modal.querySelectorAll('.flock-row').forEach((row, index) => {
        let name = row.querySelector('.chicken-flock-name').value.trim();
        const count = parseInt(row.querySelector('.chicken-flock-count').value) || 0;
        const avgWeight = parseFloat(row.querySelector('.chicken-flock-weight').value) || 0;
        const deviation = parseFloat(row.querySelector('.chicken-flock-deviation').value) || 0;

        if (count > 0) {
            if (avgWeight <= 0) {
                hasError = true;
            }
            if (name === '') {
                name = `Chov ${index + 1}`;
            }
            flocks.push({ name, count, avgWeight, deviation });
        }
    });

    if (hasError) {
        showToast('Zadejte prosím platnou průměrnou váhu pro každý chov s počtem kuřat.', 'error');
        return;
    }
    
    if (flocks.length === 0) {
        delete appState.chickenCounts[date];
    } else {
         appState.chickenCounts[date] = { startTime, delayHours, delayMinutes, flocks };
    }

    saveState();
    renderProductionOverview();
    modal.classList.remove('active');
    showToast('Data o kuřatech byla uložena.');
}

export function openPauseModal() {
    const modal = DOMElements.pauseModal;
    modal.querySelector('#pause-start-time').value = new Date().toTimeString().slice(0,5);
    modal.classList.add('active');
}

export function savePause() {
    const date = appState.ui.selectedDate;
    const startTime = DOMElements.pauseModal.querySelector('#pause-start-time').value;
    if (!startTime) {
        showToast('Zadejte čas začátku pauzy.', 'error');
        return;
    }
    if (!appState.productionEvents[date]) {
        appState.productionEvents[date] = [];
    }
    
    // Find and remove any existing pause for the day to ensure only one is present
    const existingPauseIndex = appState.productionEvents[date].findIndex(event => event.type === 'pause');
    if (existingPauseIndex > -1) {
        appState.productionEvents[date].splice(existingPauseIndex, 1);
    }

    // Add the new pause
    appState.productionEvents[date].push({
        id: Date.now(),
        type: 'pause',
        startTime: startTime
    });

    saveState();
    renderProductionOverview();
    DOMElements.pauseModal.classList.remove('active');
    showToast('Pauza byla uložena.');
}

export function openBreakdownModal() {
    const modal = DOMElements.breakdownModal;
    modal.querySelector('#breakdown-start-time').value = new Date().toTimeString().slice(0,5);
    modal.querySelector('#breakdown-duration').value = '';
    modal.classList.add('active');
}

export function saveBreakdown() {
    const date = appState.ui.selectedDate;
    const startTime = DOMElements.breakdownModal.querySelector('#breakdown-start-time').value;
    const duration = parseInt(DOMElements.breakdownModal.querySelector('#breakdown-duration').value, 10);

    if (!startTime || !duration || duration <= 0) {
        showToast('Zadejte platný čas a délku trvání poruchy.', 'error');
        return;
    }
    if (!appState.productionEvents[date]) {
        appState.productionEvents[date] = [];
    }
    appState.productionEvents[date].push({
        id: Date.now(),
        type: 'breakdown',
        startTime: startTime,
        duration: duration
    });
    saveState();
    renderProductionOverview();
    DOMElements.breakdownModal.classList.remove('active');
    showToast('Porucha byla přidána do plánu.');
}

export function deleteProductionEvent(eventId) {
    const date = appState.ui.selectedDate;
    if (appState.productionEvents[date]) {
        appState.productionEvents[date] = appState.productionEvents[date].filter(e => e.id != eventId);
        saveState();
        renderProductionOverview();
        showToast('Událost byla smazána.');
    }
}

export function deleteProductionFlock(index) {
    const date = appState.ui.selectedDate;
    const dailyData = appState.chickenCounts[date];
    const flock = dailyData?.flocks[index];

    if (!flock) return;

    showConfirmation(`Opravdu chcete smazat chov "${flock.name}"?`, () => {
        dailyData.flocks.splice(index, 1);
        if (dailyData.flocks.length === 0) {
            delete appState.chickenCounts[date];
        }
        saveState();
        renderProductionOverview();
        showToast(`Chov "${flock.name}" byl smazán.`);
    });
}

export function openBatchReductionModal() {
    const modal = DOMElements.batchReductionModal;
    const body = modal.querySelector('#batch-reduction-modal-body');
    const date = appState.ui.selectedDate;
    const dailyData = appState.chickenCounts[date];

    if (!dailyData || !dailyData.flocks || dailyData.flocks.length === 0) {
        body.innerHTML = '<p>Pro tento den nebyly zadány žádné chovy.</p>';
        modal.classList.add('active');
        return;
    }

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th>Název chovu</th>
                <th>Aktuální počet (ks)</th>
                <th>Odebrat (ks)</th>
            </tr>
        </thead>
        <tbody>`;
    
    dailyData.flocks.forEach((flock, index) => {
        tableHTML += `
            <tr>
                <td>${flock.name}</td>
                <td>${flock.count.toLocaleString('cs-CZ')}</td>
                <td><input type="number" class="reduction-amount-input" min="0" max="${flock.count}" data-index="${index}" style="width: 120px;"></td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;
    modal.classList.add('active');
}

export function saveBatchReduction() {
    const modal = DOMElements.batchReductionModal;
    const date = appState.ui.selectedDate;
    const dailyData = appState.chickenCounts[date];
    if (!dailyData) return;

    let changesMade = 0;
    const inputs = modal.querySelectorAll('.reduction-amount-input');
    
    for (const input of inputs) {
        const index = parseInt(input.dataset.index, 10);
        const amount = parseInt(input.value, 10);
        const flock = dailyData.flocks[index];

        if (!isNaN(amount) && amount > 0 && flock) {
            if (amount > flock.count) {
                showToast(`Nelze odebrat více kuřat z chovu "${flock.name}", než je aktuální počet.`, 'error');
                return; // Stop saving
            }
            flock.count -= amount;
            changesMade++;
        }
    }

    // Clean up any flocks that have been reduced to zero or less
    dailyData.flocks = dailyData.flocks.filter(flock => flock.count > 0);

    if (dailyData.flocks.length === 0) {
        delete appState.chickenCounts[date];
    }
    
    saveState();
    modal.classList.remove('active');
    renderProductionOverview();
    
    if (changesMade > 0) {
        showToast('Ubírka byla uložena.');
    }
}

export function exportProductionOverviewToPdf() {
    const date = appState.ui.selectedDate;
    const calculationResults = calculateTimeline(date);
    const { timeline, totals } = calculationResults;

    if (timeline.length === 0) {
        showToast('Není co exportovat. Nejprve zadejte data o naskladnění kuřat.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const formattedDate = new Date(date).toLocaleDateString('cs-CZ');

    doc.setFontSize(18);
    doc.text(`Prehled vyroby - ${formattedDate}`, 14, 22);
    
    // --- Timeline Table ---
    let head = [['Cas od', 'Cas do', 'Delka', 'Popis', 'Detail']];
    let body = timeline.map(item => {
        const duration = item.endTime - item.startTime;
        const durationStr = `${Math.floor(duration / 60)}h ${Math.round(duration % 60)}m`;
        let description = '';
        let detail = '';

        if (item.type === 'flock') {
            description = `Chov: ${item.name}`;
            detail = `${item.count.toLocaleString('cs-CZ')} ks, prum. ${item.avgWeight.toFixed(2)} kg`;
        } else if (item.type === 'pause') {
            description = `Pauza`;
        } else if (item.type === 'breakdown') {
            description = `Porucha`;
        }

        return [
            minutesToTimeString(item.startTime),
            minutesToTimeString(item.endTime),
            durationStr,
            description,
            detail
        ];
    });

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        headStyles: { fillColor: [41, 128, 186] },
        styles: { font: 'Helvetica' } // Basic font, might not support all Czech characters
    });

    let finalY = doc.autoTable.previous.finalY + 15;

    // --- Yield Table ---
    const { yieldData } = calculateYieldData(date, appState.chickenCounts[date]?.flocks, totals.totalWeight);
    head = [['Cast', 'Vyprodukovano (kg)', 'Potreba (kg)', 'Rozdil (kg)']];
    body = yieldData.map(d => [
        d.name,
        d.produced.toFixed(2),
        d.needed.toFixed(2),
        d.difference.toFixed(2)
    ]);
    
    doc.autoTable({
        startY: finalY,
        head: head,
        headStyles: { fillColor: [41, 128, 186] },
        styles: { font: 'Helvetica' }
    });
    
    doc.save(`Prehled_vyroby_${date}.pdf`);
    showToast('PDF s přehledem výroby bylo vygenerováno.');
}

export function openSurovinaOverviewModal() {
    const modal = DOMElements.surovinaOverviewModal;
    const body = modal.querySelector('#surovina-overview-body');
    const date = appState.ui.selectedDate;

    // 1. Gather all needs
    const allNeeds = {};
    const standardNeeds = getDailyNeeds(date, null, false); // Use false to get remaining needs
    for (const surovinaId in standardNeeds) {
        const surovina = appState.suroviny.find(s => s.id === surovinaId);
        if (surovina) {
            allNeeds[surovina.id] = { 
                name: surovina.name, 
                neededKg: (allNeeds[surovina.id]?.neededKg || 0) + standardNeeds[surovinaId]
            };
        }
    }

    const maykawaThighsNeeded = getMaykawaThighsNeeded(date);
    if (maykawaThighsNeeded > 0) {
        const thighsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'STEHNA');
        if (thighsSurovina) {
            if (!allNeeds[thighsSurovina.id]) allNeeds[thighsSurovina.id] = { name: thighsSurovina.name, neededKg: 0 };
            allNeeds[thighsSurovina.id].neededKg += maykawaThighsNeeded;
        }
    }

    const spizyNeeds = getSpizyNeeds(date);
    const rizkySurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'ŘÍZKY');
    if (rizkySurovina && spizyNeeds.rizky > 0) {
         if (!allNeeds[rizkySurovina.id]) allNeeds[rizkySurovina.id] = { name: rizkySurovina.name, neededKg: 0 };
         allNeeds[rizkySurovina.id].neededKg += spizyNeeds.rizky;
    }
    
    const kfcWingsProduct = appState.kfcProducts.find(p => p.name.toLowerCase() === 'křídla');
    if (kfcWingsProduct) {
        const kfcOrderData = appState.kfcOrders[date]?.today?.[kfcWingsProduct.id];
        const orderedBoxes = kfcOrderData?.ordered || 0;
        if (orderedBoxes > 0) {
            const wingsSurovina = appState.suroviny.find(s => s.name.toUpperCase() === 'KŘÍDLA');
            if (wingsSurovina) {
                const neededKg = orderedBoxes * (kfcWingsProduct.boxWeight / 1000);
                if (!allNeeds[wingsSurovina.id]) {
                     allNeeds[wingsSurovina.id] = { name: wingsSurovina.name, neededKg: 0 };
                }
                allNeeds[wingsSurovina.id].neededKg += neededKg;
            }
        }
    }

    // 2. Gather all stock and yield levels
    const calculationResults = calculateTimeline(date);
    const dailyData = appState.chickenCounts[date];
    const { yieldData } = calculateYieldData(date, dailyData?.flocks, calculationResults.totals.totalWeight);
    
    // 3. Filter and render the table for specific items
    const displaySurovinyNames = ['STEHNA', 'ŘÍZKY', 'PRSA', 'KŘÍDLA', 'JÁTRA', 'SRDCE', 'ŽALUDKY', 'KRKY'];
    const displaySuroviny = appState.suroviny
        .filter(s => displaySurovinyNames.includes(s.name.toUpperCase()))
        .sort((a,b) => a.name.localeCompare(b.name));
    
    const prsaSurovina = displaySuroviny.find(s => s.name.toUpperCase() === 'PRSA');

    let tableHTML = `<table class="data-table">
        <thead>
            <tr>
                <th>Surovina</th>
                <th>Zbytek (kg)</th>
                <th>Zbytek (palety)</th>
                <th>Převést na řízky</th>
                <th>Převést</th>
            </tr>
        </thead>
        <tbody>`;
    
    let rowsRendered = 0;
    for (const surovina of displaySuroviny) {
        const key = surovina.id;
        const neededKg = allNeeds[key]?.neededKg || 0;
        
        const boxes = appState.dailyStockAdjustments[date]?.[surovina.id] || 0;
        const stockKg = (surovina.stock || 0) * (surovina.paletteWeight || 0) + boxes * (surovina.boxWeight || 25);

        const yieldInfo = yieldData.find(d => d.name.toUpperCase() === surovina.name.toUpperCase());
        const producedKg = yieldInfo ? yieldInfo.produced : 0;
        
        const difference = (stockKg + producedKg) - neededKg;

        if (difference <= 0.01) continue; // Only show surplus
        rowsRendered++;

        const diffClass = 'surplus';
        const paletteWeight = surovina.paletteWeight || 0;
        const differencePallets = paletteWeight > 0 ? (difference / paletteWeight) : 0;
        
        let convertToRizkyCell = '<td>-</td>';
        if (prsaSurovina && key === prsaSurovina.id && difference > 0) {
            const potentialRizkyKg = difference * 0.70;
            convertToRizkyCell = `
                <td>
                    <span id="rizky-conversion-${key}" style="display: none; font-weight: bold;" class="surplus">${potentialRizkyKg.toFixed(2)} kg</span>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;"
                            onclick="this.style.display='none'; document.getElementById('rizky-conversion-${key}').style.display='block';">
                        Převeď na řízky
                    </button>
                </td>`;
        }

        tableHTML += `
            <tr>
                <td>${surovina.name}</td>
                <td class="${diffClass}" data-surplus="${difference.toFixed(2)}">${difference.toFixed(2)}</td>
                <td class="${diffClass}">${differencePallets.toFixed(2)}</td>
                ${convertToRizkyCell}
                <td>
                    <input type="checkbox" class="transfer-stock-checkbox" data-key="${key}" checked>
                </td>
            </tr>
        `;
    }

    if (rowsRendered === 0) {
        tableHTML += '<tr><td colspan="5" style="text-align: center;">Po dnešní výrobě nezbývá žádná z požadovaných surovin.</td></tr>';
    }
    
    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;
    modal.classList.add('active');
}


export function transferStockToTomorrow() {
    const modal = DOMElements.surovinaOverviewModal;
    const date = appState.ui.selectedDate;
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (!appState.dailyStockAdjustments[tomorrowStr]) {
        appState.dailyStockAdjustments[tomorrowStr] = {};
    }

    let transferredCount = 0;
    
    modal.querySelectorAll('.transfer-stock-checkbox:checked').forEach(checkbox => {
        const key = checkbox.dataset.key;
        const surplusEl = checkbox.closest('tr').querySelector('[data-surplus]');
        const surplusKg = parseFloat(surplusEl.dataset.surplus);

        if (surplusKg > 0) {
            transferredCount++;
            
            const standardSurovina = appState.suroviny.find(s => s.id === key);
            if (standardSurovina && !standardSurovina.isMix && !standardSurovina.isProduct) {
                const boxWeight = standardSurovina.boxWeight || 25;
                if (boxWeight > 0) {
                    const boxesToAdd = Math.round(surplusKg / boxWeight);
                    appState.dailyStockAdjustments[tomorrowStr][key] = (appState.dailyStockAdjustments[tomorrowStr][key] || 0) + boxesToAdd;
                }
                return;
            }

            const kfcSurovina = appState.kfcSuroviny.find(s => s.id === key);
            if (kfcSurovina) {
                const boxWeight = kfcSurovina.boxWeight / 1000;
                 if (boxWeight > 0) {
                    const boxesToAdd = Math.round(surplusKg / boxWeight);
                    kfcSurovina.stockBoxes = (kfcSurovina.stockBoxes || 0) + boxesToAdd;
                 }
                return;
            }

            const spizyKey = key.replace('spizy_', '');
            if (appState.spizyStock.hasOwnProperty(spizyKey)) {
                appState.spizyStock[spizyKey] = (appState.spizyStock[spizyKey] || 0) + surplusKg;
            }
        }
    });

    saveState();
    modal.classList.remove('active');
    
    if (transferredCount > 0) {
        showToast(`${transferredCount} položek převedeno do dalšího dne.`);
    } else {
        showToast('Nebyly vybrány žádné položky s přebytkem k převodu.');
    }
}