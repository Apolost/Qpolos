
// @ts-nocheck
import { employeeState, monthNames } from '../state.ts';
import { openModal, closeModal, showToast } from '../ui.ts';

function renderExportMonthsList() {
    const listEl = document.getElementById('export-departures-months-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    if (employeeState.exportMonths.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-center p-2">Žádné měsíce nebyly vybrány.</p>';
        return;
    }

    employeeState.exportMonths.forEach(({ year, month }) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-200';
        div.innerHTML = `
            <span class="font-medium text-gray-700">${monthNames[month]} ${year}</span>
        `;
        listEl.appendChild(div);
    });
}

export function openExportDeparturesModal() {
    const now = new Date();
    employeeState.exportMonths = [{ year: now.getFullYear(), month: now.getMonth() }];
    renderExportMonthsList();
    openModal(document.getElementById('export-departures-modal'));
}

export function addExportMonth() {
    if (employeeState.exportMonths.length === 0) return;
    
    const lastEntry = employeeState.exportMonths[employeeState.exportMonths.length - 1];
    let { year, month } = lastEntry;
    
    month++;
    if (month > 11) {
        month = 0;
        year++;
    }
    
    employeeState.exportMonths.push({ year, month });
    renderExportMonthsList();
}

export function generateDeparturesExcel() {
    if (employeeState.exportMonths.length === 0) {
        showToast('Vyberte alespoň jeden měsíc.', 'error');
        return;
    }

    // 1. Gather employees who depart in selected months
    const departingEmployees = employeeState.employees.filter(emp => {
        if (!emp.departureDate) return false;
        const d = new Date(emp.departureDate);
        const empYear = d.getFullYear();
        const empMonth = d.getMonth();
        
        return employeeState.exportMonths.some(m => m.year === empYear && m.month === empMonth);
    });

    if (departingEmployees.length === 0) {
        showToast('V zadaném období nebyly nalezeny žádné odjezdy.', 'warning');
        return;
    }

    // 2. Separate by Shift
    const shift1 = departingEmployees.filter(e => e.shift === '1');
    const shift2 = departingEmployees.filter(e => e.shift === '2');

    // 3. Prepare Data for Excel
    // Structure:
    // [ "1. Smena", "", "", "2. Smena", "", "" ]
    // [ "Jmeno", "Cip", "Umisteni", "Jmeno", "Cip", "Umisteni" ]
    // ... rows ...
    
    const data = [];
    
    // Header Row
    data.push(["1. SMĚNA", "", "", "", "2. SMĚNA", "", ""]);
    data.push(["Jméno a Příjmení", "Čip", "Umístění", "", "Jméno a Příjmení", "Čip", "Umístění"]);

    const maxRows = Math.max(shift1.length, shift2.length);

    for (let i = 0; i < maxRows; i++) {
        const s1 = shift1[i];
        const s2 = shift2[i];
        
        const row = [];
        
        // Shift 1 Data
        if (s1) {
            const locName = employeeState.workLocations.find(l => l.id == s1.locationId)?.name || '';
            row.push(`${s1.lastName} ${s1.firstName}`, s1.chip || '', locName);
        } else {
            row.push("", "", "");
        }

        // Spacer
        row.push("");

        // Shift 2 Data
        if (s2) {
            const locName = employeeState.workLocations.find(l => l.id == s2.locationId)?.name || '';
            row.push(`${s2.lastName} ${s2.firstName}`, s2.chip || '', locName);
        } else {
            row.push("", "", "");
        }
        
        data.push(row);
    }

    // Footer / Totals
    data.push(["", "", "", "", "", "", ""]); // Empty row
    data.push([`Celkem 1. směna: ${shift1.length}`, "", "", "", `Celkem 2. směna: ${shift2.length}`, "", ""]);
    data.push([`Dohromady: ${shift1.length + shift2.length}`, "", "", "", "", "", ""]);

    // 4. Generate Sheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Adjust column widths (approximate)
    const wscols = [
        { wch: 25 }, // Name 1
        { wch: 15 }, // Chip 1
        { wch: 20 }, // Loc 1
        { wch: 5 },  // Spacer
        { wch: 25 }, // Name 2
        { wch: 15 }, // Chip 2
        { wch: 20 }  // Loc 2
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Odjezdy");

    // 5. Export
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Odjezdy_Export_${dateStr}.xlsx`);
    
    closeModal(document.getElementById('export-departures-modal'));
    showToast('Excel soubor byl vygenerován.');
}
