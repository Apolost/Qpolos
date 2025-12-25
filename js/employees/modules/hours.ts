
// @ts-nocheck
import { employeeState, saveDataToLocalStorage } from '../state.ts';
import { openModal, closeModal } from '../ui.ts';

export const renderHoursView = () => {
    const year = employeeState.currentDate.getFullYear();
    const month = employeeState.currentDate.getMonth();
    const container = document.getElementById('hours-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    const writeOffsByDate = {};
    const monthlyWriteOffs = employeeState.hoursWriteOffs.filter(wo => {
        const d = new Date(wo.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });
    monthlyWriteOffs.forEach(wo => {
        if (!writeOffsByDate[wo.date]) {
            writeOffsByDate[wo.date] = 0;
        }
        writeOffsByDate[wo.date] += parseFloat(wo.hours);
    });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

    let totalHours = 0, totalNetto = 0, totalBizerba = 0;
    
    const method = employeeState.hoursSettings.calculation_method || 'tons_per_hour';
    const unit = method === 'tons_per_hour' ? 't/h' : 'h/t';

    let tableHTML = `<div class="border rounded-lg overflow-hidden"><table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-600">
            <tr>
                <th class="p-2 text-left font-semibold">Datum</th>
                <th class="p-2 text-right font-semibold">Hodiny</th>
                <th class="p-2 text-right font-semibold">Netto (kg)</th>
                <th class="p-2 text-right font-semibold">Bizzerba (kg)</th>
                <th class="p-2 text-right font-semibold">Výkon (${unit})</th>
                <th class="p-2 text-center font-semibold">Akce</th>
            </tr>
        </thead><tbody>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayName = dayNames[d.getDay()];
        const data = employeeState.hoursData[dateString];

        if (data) {
            const dailyWriteOffs = writeOffsByDate[dateString] || 0;
            const recordedHours = parseFloat(data.hours) || 0;
            const effectiveHours = recordedHours - dailyWriteOffs;

            let performanceHtml = '---';
            const nettoKg = parseFloat(data.netto_kg) || 0;
            const bizzerbaKg = parseFloat(data.bizzerba_kg) || 0;
            const totalKg = nettoKg + bizzerbaKg;
            
            if (totalKg > 0 && effectiveHours > 0) {
                let performance = 0;
                 if (method === 'tons_per_hour') {
                    performance = (totalKg / 1000) / effectiveHours;
                } else { // hours_per_ton
                    performance = effectiveHours / (totalKg / 1000);
                }
                
                let isOffTarget;
                if (method === 'tons_per_hour') {
                    isOffTarget = performance < employeeState.hoursSettings.optimal_tons_per_hour;
                } else {
                    const optimalHoursPerTon = 1 / employeeState.hoursSettings.optimal_tons_per_hour;
                    isOffTarget = performance > optimalHoursPerTon;
                }
                const colorClass = isOffTarget ? 'performance-red' : 'performance-green';
                performanceHtml = `<span class="font-bold ${colorClass}">${performance.toFixed(3)}</span>`;
            }
            
            totalHours += effectiveHours;
            totalNetto += nettoKg;
            totalBizerba += bizzerbaKg;

            tableHTML += `
                <tr class="border-t">
                    <td class="p-2 font-medium">${day}. ${month+1}. (${dayName})</td>
                    <td class="p-2 text-right">${data.hours}${dailyWriteOffs > 0 ? ` (-${dailyWriteOffs})` : ''}</td>
                    <td class="p-2 text-right">${nettoKg.toLocaleString('cs-CZ')}</td>
                    <td class="p-2 text-right">${bizzerbaKg.toLocaleString('cs-CZ')}</td>
                    <td class="p-2 text-right">${performanceHtml}</td>
                    <td class="p-2 text-center">
                        <button class="edit-hours-btn p-1.5 rounded-full hover:bg-slate-100" data-date="${dateString}">
                            <i data-feather="edit-2" class="w-4 h-4 text-slate-600"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    }
    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
    
    let avgPerformance = 0;
    const totalProducedKg = totalNetto + totalBizerba;
    if (totalProducedKg > 0 && totalHours > 0) {
        if (method === 'tons_per_hour') {
            avgPerformance = (totalProducedKg / 1000) / totalHours;
        } else {
            avgPerformance = totalHours / (totalProducedKg / 1000);
        }
    }

    document.getElementById('hours-summary').innerHTML = `
         <h3 class="text-xl font-bold mb-4 text-gray-800">Měsíční souhrn</h3>
         <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
                <p class="text-sm text-gray-500">Celkem Netto</p>
                <p class="text-2xl font-bold">${totalNetto.toLocaleString('cs-CZ')} kg</p>
            </div>
            <div>
                <p class="text-sm text-gray-500">Celkem Bizzerba</p>
                <p class="text-2xl font-bold">${totalBizerba.toLocaleString('cs-CZ')} kg</p>
            </div>
            <div>
                <p class="text-sm text-gray-500">Celkem hodin (po upsání)</p>
                <p class="text-2xl font-bold">${totalHours.toLocaleString('cs-CZ', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</p>
            </div>
            <div>
                <p class="text-sm text-gray-500">Průměrný výkon</p>
                <p class="text-2xl font-bold">${avgPerformance > 0 ? avgPerformance.toFixed(3) : '0'} ${unit}</p>
            </div>
         </div>
    `;

    const writeOffsListEl = document.getElementById('write-offs-list');
    const totalWriteOffsHours = monthlyWriteOffs.reduce((sum, wo) => sum + parseFloat(wo.hours), 0);
    document.getElementById('write-offs-total').textContent = `${totalWriteOffsHours.toLocaleString('cs-CZ')} hod`;
    
    if (monthlyWriteOffs.length > 0) {
        writeOffsListEl.innerHTML = `
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th class="px-4 py-2">Datum</th>
                        <th class="px-4 py-2">Zaměstnanec</th>
                        <th class="px-4 py-2">Čip</th>
                        <th class="px-4 py-2 text-right">Upsané hodiny</th>
                        <th class="px-4 py-2 text-center">Akce</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthlyWriteOffs.sort((a,b) => new Date(a.date) - new Date(b.date)).map(wo => {
                        const employee = employeeState.employees.find(e => e.id == wo.employeeId);
                        return `
                            <tr class="bg-white border-b">
                                <td class="px-4 py-2">${new Date(wo.date).toLocaleDateString('cs-CZ')}</td>
                                <td class="px-4 py-2">${employee ? `${employee.firstName} ${employee.lastName}` : 'Neznámý'}</td>
                                <td class="px-4 py-2">${employee ? employee.chip : 'N/A'}</td>
                                <td class="px-4 py-2 text-right font-semibold">${wo.hours}</td>
                                <td class="px-4 py-2 text-center flex items-center justify-center gap-2">
                                    <button class="view-reason-btn p-1.5 rounded-full hover:bg-slate-100" data-id="${wo.id}"><i data-feather="info" class="w-4 h-4 text-blue-600"></i></button>
                                    <button class="edit-write-off-btn p-1.5 rounded-full hover:bg-slate-100" data-id="${wo.id}"><i data-feather="edit-2" class="w-4 h-4 text-slate-600"></i></button>
                                    <button class="delete-write-off-btn p-1.5 rounded-full hover:bg-slate-100" data-id="${wo.id}"><i data-feather="trash-2" class="w-4 h-4 text-red-600"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } else {
        writeOffsListEl.innerHTML = `<p class="text-center text-gray-500">Tento měsíc nebyly upsány žádné hodiny.</p>`;
    }
    feather.replace();
};

export const openAddHoursModal = (dateString = null) => {
    const addHoursForm = document.getElementById('add-hours-form');
    addHoursForm.reset();
    const deleteBtn = document.getElementById('delete-hours-entry-btn');
    const title = document.getElementById('add-hours-modal-title');
    
    if (dateString && employeeState.hoursData[dateString]) {
        const data = employeeState.hoursData[dateString];
        document.getElementById('hours-date').value = dateString;
        document.getElementById('hours-worked').value = data.hours;
        document.getElementById('hours-bizzerba-kg').value = data.bizzerba_kg;
        document.getElementById('hours-netto-kg').value = data.netto_kg;
        deleteBtn.classList.remove('hidden');
        title.textContent = 'Upravit záznam';
    } else {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('hours-date').value = dateString || today;
        deleteBtn.classList.add('hidden');
        title.textContent = 'Přidat záznam o výrobě';
    }
    openModal(document.getElementById('add-hours-modal'));
};

export const openWriteOffHoursModal = (writeOff = null) => {
    const writeOffHoursForm = document.getElementById('write-off-hours-form');
    writeOffHoursForm.reset();
    document.getElementById('write-off-employee-info').classList.add('hidden');
    
    if (writeOff) {
        document.getElementById('write-off-id').value = writeOff.id;
        const employee = employeeState.employees.find(e => e.id == writeOff.employeeId);
        if (employee && employee.chip) {
            const chipInput = document.getElementById('write-off-chip');
            chipInput.value = employee.chip;
            chipInput.dispatchEvent(new Event('input'));
        }
        document.getElementById('write-off-date').value = writeOff.date;
        document.getElementById('write-off-hours').value = writeOff.hours;
        document.getElementById('write-off-reason').value = writeOff.reason;
    } else {
         document.getElementById('write-off-id').value = '';
         document.getElementById('write-off-date').value = new Date().toISOString().split('T')[0];
    }
    openModal(document.getElementById('write-off-hours-modal'));
};
