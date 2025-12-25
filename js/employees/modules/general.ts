
// @ts-nocheck
import { employeeState, monthNames, saveDataToLocalStorage } from '../state.ts';
import { openModal, closeModal, updateEmployeeLocationSelect } from '../ui.ts';

export const renderCalendar = () => {
    const calendarContainer = document.getElementById('calendar-container');
    const calendarBody = document.getElementById('calendar-body');
    const monthYearEls = document.querySelectorAll('.month-year-display');

    if(!calendarBody) return;

    calendarContainer.classList.add('switching');
    
    setTimeout(() => {
        const year = employeeState.currentDate.getFullYear();
        const month = employeeState.currentDate.getMonth();

        monthYearEls.forEach(el => el.textContent = `${monthNames[month]} ${year}`);
        calendarBody.innerHTML = '';

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const dayOffset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

        for (let i = 0; i < dayOffset; i++) {
            calendarBody.innerHTML += `<div class="bg-slate-50"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const isToday = dayDate.toDateString() === new Date().toDateString();
            
            const departures = employeeState.employees.filter(emp => {
                if (!emp.departureDate) return false;
                const empDate = new Date(emp.departureDate);
                return empDate.getFullYear() === year && empDate.getMonth() === month && empDate.getDate() === day;
            });

            let departureHtml = '';
            if (departures.length > 0) {
                const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                departureHtml = `<div class="departure-count" data-date="${dateString}" title="${departures.length} odjezdů">${departures.length}</div>`;
            }

            calendarBody.innerHTML += `
                <div class="calendar-day bg-white p-2 flex flex-col items-start justify-start border-r border-b border-gray-200">
                    <span class="text-sm font-medium text-gray-700 ${isToday ? 'today' : ''}">${day}</span>
                    ${departureHtml}
                </div>
            `;
        }
        calendarContainer.classList.remove('switching');
        updateAllViews();
    }, 200);
};

export const updateDeparturesInfo = () => {
    const departuresInfoEl = document.getElementById('departures-info');
    if(!departuresInfoEl) return;

    const currentMonth = employeeState.currentDate.getMonth();
    const currentYear = employeeState.currentDate.getFullYear();
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonth = nextMonthDate.getMonth();
    const nextMonthYear = nextMonthDate.getFullYear();

    const departuresThisMonth = employeeState.employees.filter(emp => {
        if (!emp.departureDate) return false;
        const d = new Date(emp.departureDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a,b) => new Date(a.departureDate) - new Date(b.departureDate));

    const departuresNextMonth = employeeState.employees.filter(emp => {
        if (!emp.departureDate) return false;
        const d = new Date(emp.departureDate);
        return d.getMonth() === nextMonth && d.getFullYear() === nextMonthYear;
    }).sort((a,b) => new Date(a.departureDate) - new Date(b.departureDate));
    
    const formatDeparture = (emp) => {
        const d = new Date(emp.departureDate);
        return `<div class="text-sm mb-1 p-2 rounded-md bg-white border border-gray-200">
                    <span class="font-semibold">${emp.firstName} ${emp.lastName}</span>
                    <span class="block text-xs text-gray-500">${d.toLocaleDateString('cs-CZ')}</span>
                </div>`;
    };

    departuresInfoEl.innerHTML = `
        <div class="mb-4">
            <h3 class="font-semibold text-gray-700 mb-2">Tento měsíc (${departuresThisMonth.length})</h3>
            <div class="space-y-1 max-h-48 overflow-y-auto pr-2">
               ${departuresThisMonth.length > 0 ? departuresThisMonth.map(formatDeparture).join('') : '<p class="text-xs text-gray-500">Žádné odjezdy.</p>'}
            </div>
        </div>
        <div>
            <h3 class="font-semibold text-gray-700 mb-2">Následující měsíc (${departuresNextMonth.length})</h3>
            <div class="space-y-1 max-h-48 overflow-y-auto pr-2">
               ${departuresNextMonth.length > 0 ? departuresNextMonth.map(formatDeparture).join('') : '<p class="text-xs text-gray-500">Žádné odjezdy.</p>'}
            </div>
        </div>
    `;
};

export const updateUnknownDeparturesInfo = () => {
    const unknownDeparturesInfoEl = document.getElementById('unknown-departures-info');
    if(!unknownDeparturesInfoEl) return;

    const unknownDepartureEmployees = employeeState.employees.filter(emp => !emp.departureDate);
    if (unknownDepartureEmployees.length === 0) {
        unknownDeparturesInfoEl.innerHTML = '<p class="text-xs text-gray-500">Všichni zaměstnanci mají zadaný odjezd.</p>';
        return;
    }
    
    unknownDeparturesInfoEl.innerHTML = `
        <div class="space-y-1 max-h-48 overflow-y-auto pr-2">
        ${unknownDepartureEmployees.map(emp => `
            <div class="text-sm p-2 rounded-md bg-white border border-gray-200 flex justify-between items-center">
                <div>
                    <span class="font-semibold">${emp.firstName} ${emp.lastName}</span>
                    <span class="block text-xs text-gray-500">Čip: ${emp.chip || 'N/A'}</span>
                </div>
                <button class="fill-departure-btn bg-indigo-100 text-indigo-700 text-xs font-bold py-1 px-2 rounded-md hover:bg-indigo-200" data-id="${emp.id}">Doplnit</button>
            </div>
        `).join('')}
        </div>
    `;
};

export const updateShiftsView = () => {
    const shiftsContentEl = document.getElementById('shifts-content');
    if(!shiftsContentEl) return;

    const shift1 = employeeState.employees.filter(e => e.shift === '1');
    const shift2 = employeeState.employees.filter(e => e.shift === '2');
    
    const createShiftHtml = (employeesList) => {
        if (employeesList.length === 0) return '<li>Žádní zaměstnanci</li>';
        return employeesList.map(e => `
            <li class="flex justify-between items-center py-1">
                <span>${e.firstName} ${e.lastName}</span>
                <button class="delete-employee-shift-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-all duration-150" data-id="${e.id}" title="Smazat zaměstnance">
                    <i data-feather="trash-2" class="w-4 h-4"></i>
                </button>
            </li>`).join('');
    };

    shiftsContentEl.innerHTML = `
        <div class="flex-1">
            <h3 class="text-lg font-bold text-blue-700 mb-2">1. směna (${shift1.length})</h3>
            <ul class="space-y-1 bg-blue-50 p-3 rounded-lg">${createShiftHtml(shift1)}</ul>
        </div>
         <div class="flex-1">
            <h3 class="text-lg font-bold text-green-700 mb-2">2. směna (${shift2.length})</h3>
            <ul class="space-y-1 bg-green-50 p-3 rounded-lg">${createShiftHtml(shift2)}</ul>
        </div>
    `;
    document.getElementById('shifts-total').textContent = `Celkem zaměstnanců: ${employeeState.employees.length}`;
    feather.replace();
};

export const renderLocations = () => {
    const listEl = document.getElementById('locations-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    if (employeeState.workLocations.length === 0) {
        listEl.innerHTML = `<p class="text-gray-500 text-center py-4">Zatím nebyla přidána žádná umístění.</p>`;
        return;
    }
    employeeState.workLocations.forEach(loc => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg';
        item.innerHTML = `
            <span class="font-medium text-gray-800">${loc.name}</span>
            <div class="flex gap-1">
                <button class="edit-location-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-indigo-600 transition-all duration-150" data-id="${loc.id}"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                <button class="delete-location-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-red-600 transition-all duration-150" data-id="${loc.id}"><i data-feather="trash-2" class="w-4 h-4"></i></button>
            </div>
        `;
        listEl.appendChild(item);
    });
    feather.replace();
};

export const renderLocationsOverview = () => {
    const locationsOverviewEl = document.getElementById('locations-overview');
    if(!locationsOverviewEl) return;

    locationsOverviewEl.innerHTML = '';
    if (employeeState.workLocations.length === 0) {
        locationsOverviewEl.innerHTML = `<p class="text-gray-500 text-center py-4 bg-slate-50 rounded-lg">Přidejte pracovní umístění, aby se zde zobrazili zaměstnanci.</p>`;
        return;
    }

    employeeState.workLocations.forEach(loc => {
        const employeesInLocation = employeeState.employees.filter(emp => emp.locationId == loc.id);
        const shift1Employees = employeesInLocation.filter(emp => emp.shift == '1');
        const shift2Employees = employeesInLocation.filter(emp => emp.shift == '2');
        
        const locationEl = document.createElement('div');
        locationEl.className = 'bg-slate-50 rounded-lg border';
        
        const createEmployeeListHtml = (list) => {
            if (list.length === 0) return '<p class="px-4 py-2 text-sm text-gray-500 border-b">Žádní zaměstnanci na směně.</p>';
            return list.map(emp => `
                <div class="flex justify-between items-center py-2 px-4 border-b last:border-b-0">
                    <span>${emp.firstName} ${emp.lastName} <span class="text-xs text-gray-500">(Čip: ${emp.chip || 'N/A'})</span></span>
                    <button class="edit-employee-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-indigo-600 transition-all duration-150" data-id="${emp.id}"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                </div>
            `).join('');
        };

        const employeesHtml = `
            <div>
                <h4 class="font-semibold text-sm text-blue-800 bg-blue-100 p-2 rounded-t-md">1. směna (${shift1Employees.length})</h4>
                ${createEmployeeListHtml(shift1Employees)}
                <h4 class="font-semibold text-sm text-green-800 bg-green-100 p-2 mt-2">2. směna (${shift2Employees.length})</h4>
                ${createEmployeeListHtml(shift2Employees)}
            </div>
        `;

        locationEl.innerHTML = `
            <div class="flex justify-between items-center p-4 cursor-pointer location-header">
                <h3 class="font-bold text-lg text-gray-800">${loc.name}</h3>
                <div class="flex items-center gap-4 text-sm">
                    <span class="bg-blue-100 text-blue-800 font-semibold px-2 py-1 rounded-full">1. směna: ${shift1Employees.length}</span>
                    <span class="bg-green-100 text-green-800 font-semibold px-2 py-1 rounded-full">2. směna: ${shift2Employees.length}</span>
                    <i data-feather="chevron-down" class="transition-transform location-toggle-icon"></i>
                </div>
            </div>
            <div class="location-employee-list bg-white rounded-b-lg">
                ${employeesInLocation.length > 0 ? employeesHtml : '<p class="text-sm text-gray-500 p-4">V tomto umístění nejsou žádní zaměstnanci.</p>'}
            </div>
        `;
        locationsOverviewEl.appendChild(locationEl);
    });
    feather.replace();
};

export const updateMenShiftsCount = () => {
    const shift1Men = employeeState.employees.filter(e => e.shift === '1' && e.gender === 'muz').length;
    const shift2Men = employeeState.employees.filter(e => e.shift === '2' && e.gender === 'muz').length;
    
    const shift1MenEl = document.getElementById('shift1-men-count');
    const shift2MenEl = document.getElementById('shift2-men-count');
    
    if (shift1MenEl) shift1MenEl.textContent = shift1Men;
    if (shift2MenEl) shift2MenEl.textContent = shift2Men;

    const shift1Women = employeeState.employees.filter(e => e.shift === '1' && e.gender === 'zena').length;
    const shift2Women = employeeState.employees.filter(e => e.shift === '2' && e.gender === 'zena').length;

    const shift1WomenEl = document.getElementById('shift1-women-count');
    const shift2WomenEl = document.getElementById('shift2-women-count');

    if (shift1WomenEl) shift1WomenEl.textContent = shift1Women;
    if (shift2WomenEl) shift2WomenEl.textContent = shift2Women;
};

export const updateAddDepartureView = () => {
     const select = document.getElementById('departure-employee-select');
     if(!select) return;
     select.innerHTML = '<option value="" disabled selected>Vyberte...</option>';
     employeeState.employees.sort((a, b) => a.lastName.localeCompare(b.lastName)).forEach(emp => {
         const option = document.createElement('option');
         option.value = emp.id;
         option.textContent = `${emp.lastName}, ${emp.firstName}`;
         select.appendChild(option);
     });
};

export const renderDailyDeparturesModal = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const departingEmployees = employeeState.employees.filter(emp => {
        if(!emp.departureDate) return false;
        const empDate = new Date(emp.departureDate);
        return empDate.getFullYear() === year && empDate.getMonth() === month - 1 && empDate.getDate() === day;
    });

    document.getElementById('daily-departures-title').textContent = `Odjezdy ${day}. ${month}. ${year}`;
    const listEl = document.getElementById('daily-departures-list');
    listEl.innerHTML = '';

    if (departingEmployees.length === 0) {
         listEl.innerHTML = '<p>Žádné odjezdy pro tento den.</p>';
         return;
    }

    departingEmployees.forEach(emp => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg';
        item.innerHTML = `
            <span class="font-medium text-gray-800">${emp.firstName} ${emp.lastName}</span>
            <div class="flex gap-1">
                <button class="edit-employee-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-all duration-150" data-id="${emp.id}" title="Upravit zaměstnance"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                <button class="delete-employee-daily-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-all duration-150" data-id="${emp.id}" title="Smazat zaměstnance"><i data-feather="trash-2" class="w-4 h-4"></i></button>
            </div>
        `;
        listEl.appendChild(item);
    });
    feather.replace();
    openModal(document.getElementById('daily-departures-modal'));
};

export const openEmployeeModal = (employee = null) => {
    document.getElementById('add-employee-form').reset();
    updateEmployeeLocationSelect();
    if (employee) {
        document.getElementById('employee-modal-title').textContent = 'Upravit zaměstnance';
        document.getElementById('employee-id').value = employee.id;
        document.getElementById('firstName').value = employee.firstName;
        document.getElementById('lastName').value = employee.lastName;
        document.getElementById('phone').value = employee.phone;
        document.getElementById('chip').value = employee.chip || '';
        document.getElementById('location').value = employee.locationId;
        document.getElementById('shift').value = employee.shift;
        document.getElementById('gender').value = employee.gender || 'muz';
        document.getElementById('departureDate').value = employee.departureDate || '';
    } else {
        document.getElementById('employee-modal-title').textContent = 'Přidat nového zaměstnance';
        document.getElementById('employee-id').value = '';
    }
    openModal(document.getElementById('add-employee-modal'));
};

export const updateAllViews = () => {
    updateDeparturesInfo();
    updateUnknownDeparturesInfo();
    updateShiftsView();
    updateAddDepartureView();
    renderLocations();
    renderLocationsOverview();
    updateEmployeeLocationSelect();
    updateMenShiftsCount();
};

export const openEmployeeManagementModal = () => {
    const list1 = document.getElementById('manage-shift1-list');
    const list2 = document.getElementById('manage-shift2-list');
    const count1 = document.getElementById('manage-shift1-count');
    const count2 = document.getElementById('manage-shift2-count');
    
    if (!list1 || !list2) return;

    // Filter employees by shift
    const shift1Employees = employeeState.employees.filter(e => e.shift === '1').sort((a,b) => a.lastName.localeCompare(b.lastName));
    const shift2Employees = employeeState.employees.filter(e => e.shift === '2').sort((a,b) => a.lastName.localeCompare(b.lastName));

    // Prepare location options
    const locationOptions = employeeState.workLocations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    
    const createRow = (emp) => `
        <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg mb-2 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex-grow">
                <div class="font-bold text-slate-800">${emp.lastName} ${emp.firstName}</div>
                <div class="text-xs text-slate-500">Čip: ${emp.chip || '-'}</div>
            </div>
            <div class="flex items-center gap-3">
                <select class="manage-location-select text-sm p-1.5 border border-slate-300 rounded bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" data-id="${emp.id}">
                    <option value="">-- Umístění --</option>
                    ${employeeState.workLocations.map(l => `<option value="${l.id}" ${emp.locationId == l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                </select>
                <div class="flex gap-1">
                    <button class="manage-edit-btn p-1.5 rounded-full text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" data-id="${emp.id}" title="Upravit">
                        <i data-feather="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button class="manage-delete-btn p-1.5 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" data-id="${emp.id}" title="Smazat">
                        <i data-feather="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    list1.innerHTML = shift1Employees.map(createRow).join('');
    list2.innerHTML = shift2Employees.map(createRow).join('');
    
    count1.textContent = shift1Employees.length;
    count2.textContent = shift2Employees.length;

    feather.replace();
    openModal(document.getElementById('employee-management-modal'));
};
