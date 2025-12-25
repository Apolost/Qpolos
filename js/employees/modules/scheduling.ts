
// @ts-nocheck
import { employeeState, saveDataToLocalStorage } from '../state.ts';
import { openModal } from '../ui.ts';

const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const isPersonOnVacation = (personType, personId, date) => {
    const vacations = personType === 'foreman' ? employeeState.foremenVacations : employeeState.forkliftVacations;
    const checkDate = new Date(date);
    checkDate.setHours(0,0,0,0);
    return vacations.some(vac => {
        const start = new Date(vac.startDate);
        start.setHours(0,0,0,0);
        const end = new Date(vac.endDate);
        end.setHours(0,0,0,0);
        return vac.personId == personId && checkDate >= start && checkDate <= end;
    });
};

export const updateRotationToggleUI = (personType, isEnabled) => {
    const btn = document.getElementById(`toggle-${personType}-rotation`);
    const textEl = document.getElementById(`${personType}-rotation-status-text`);
    const iconEl = document.getElementById(`${personType}-rotation-status-icon`);
    if (!btn) return;
    
    if (isEnabled) {
        textEl.textContent = 'Auto: Zapnuto';
        btn.classList.remove('bg-slate-200', 'text-slate-700', 'hover:bg-slate-300');
        btn.classList.add('bg-green-100', 'text-green-800', 'hover:bg-green-200');
        iconEl.outerHTML = `<i id="${personType}-rotation-status-icon" data-feather="toggle-right" class="w-5 h-5"></i>`;
    } else {
        textEl.textContent = 'Auto: Vypnuto';
        btn.classList.add('bg-slate-200', 'text-slate-700', 'hover:bg-slate-300');
        btn.classList.remove('bg-green-100', 'text-green-800', 'hover:bg-green-200');
        iconEl.outerHTML = `<i id="${personType}-rotation-status-icon" data-feather="toggle-left" class="w-5 h-5"></i>`;
    }
    feather.replace();
};

export const renderScheduleCalendar = (personType) => {
    const container = document.getElementById(`${personType}-calendar-container`);
    if(!container) return;

    const people = personType === 'foreman' ? employeeState.foremen : employeeState.forkliftDrivers;
    const schedule = personType === 'foreman' ? employeeState.foremenSchedule : employeeState.forkliftSchedule;
    const weekendNotes = personType === 'foreman' ? employeeState.foremenWeekendNotes : employeeState.forkliftWeekendNotes;
    
    const year = employeeState.currentDate.getFullYear();
    const month = employeeState.currentDate.getMonth();
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'schedule-calendar-week bg-slate-50 font-bold text-sm text-slate-600';
    let headerHTML = `<div class="p-2 flex items-center justify-center border-r">Týden</div><div class="p-2 border-r">Směna</div>`;
    const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
    daysOfWeek.forEach(day => headerHTML += `<div class="p-2 text-center">${day}</div>`);
    header.innerHTML = headerHTML;
    container.appendChild(header);

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let currentDay = new Date(firstDayOfMonth);
    currentDay.setDate(currentDay.getDate() - (firstDayOfMonth.getDay() + 6) % 7);

    while(currentDay <= lastDayOfMonth || currentDay.getDay() !== 1) {
        const weekRow = document.createElement('div');
        weekRow.className = 'schedule-calendar-week';
        const weekStartDateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
        const weekNum = getWeekNumber(currentDay);
        
        const labelsHTML = `
            <div class="flex flex-col justify-around h-full p-2 text-xs font-bold text-right">
                <div class="flex-1 flex items-center justify-end text-[#f59e0b]">Ranní</div>
                <div class="flex-1 flex items-center justify-end text-[#fd7e14]">Odpolední</div>
                <div class="flex-1 flex items-center justify-end text-[#374151]">Noční</div>
            </div>
        `;

        weekRow.innerHTML = `
            <div class="schedule-week-number p-2 text-center font-bold text-indigo-600 flex items-center justify-center border-r bg-indigo-50" data-person-type="${personType}" data-week-start-date="${weekStartDateStr}" data-week-number="${weekNum}">${weekNum}</div>
            <div class="border-r bg-slate-50">${labelsHTML}</div>
        `;
        
        for (let i=0; i<7; i++) {
            const dayInMonth = currentDay.getMonth() === month;
            const dateString = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
            const dayOfWeek = currentDay.getDay();
            
            const allPeopleOnShiftOrVacation = new Set();
            
            const createPills = (shift) => {
                 const daySchedule = schedule[dateString] || {};
                 return (daySchedule[shift] || []).map(personId => {
                    allPeopleOnShiftOrVacation.add(personId);
                    const person = people.find(p => p.id == personId);
                    if (!person) return '';
                    return `<div class="schedule-pill ${personType}-pill ${shift}" draggable="true" data-person-type="${personType}" data-person-id="${person.id}" data-date="${dateString}" data-shift="${shift}">${person.firstName} ${person.lastName}</div>`;
                }).join('');
            }
            
            const vacationPills = people.filter(p => !allPeopleOnShiftOrVacation.has(p.id) && isPersonOnVacation(personType, p.id, dateString))
                .map(p => {
                    allPeopleOnShiftOrVacation.add(p.id);
                    return `<div class="schedule-pill vacation" data-person-id="${p.id}">${p.firstName} ${p.lastName}</div>`;
                }).join('');

            let weekendNoteIndicator = '';
            if ((dayOfWeek === 6 || dayOfWeek === 0) && weekendNotes[dateString]?.note) {
                weekendNoteIndicator = `<div class="weekend-note-indicator" title="Poznámka"><i data-feather="message-square" class="w-full h-full text-blue-500"></i></div><div class="weekend-tooltip">${weekendNotes[dateString].note}</div>`;
            }
            
            const dayEl = document.createElement('div');
            dayEl.className = `schedule-calendar-day ${dayInMonth ? 'bg-white' : 'bg-slate-50'}`;
            dayEl.dataset.date = dateString;
            dayEl.dataset.dayOfWeek = dayOfWeek;
            dayEl.dataset.personType = personType;
            dayEl.innerHTML = `
                <div class="p-1 text-xs font-semibold ${dayInMonth ? 'text-slate-700' : 'text-slate-400'}">${currentDay.getDate()}. ${currentDay.getMonth()+1}.</div>
                ${weekendNoteIndicator}
                <div class="schedule-shift-cell" data-date="${dateString}" data-shift="morning">${createPills('morning')}</div>
                <div class="schedule-shift-cell" data-date="${dateString}" data-shift="afternoon">${createPills('afternoon')}</div>
                <div class="schedule-shift-cell" data-date="${dateString}" data-shift="night">${createPills('night')} ${vacationPills}</div>
            `;
            weekRow.appendChild(dayEl);
            currentDay.setDate(currentDay.getDate() + 1);
        }
        container.appendChild(weekRow);
        if (currentDay > lastDayOfMonth && currentDay.getDay() === 1) break;
    }
    addDragDropListeners(personType);
    feather.replace();
};

const addDragDropListeners = (personType) => {
    const pills = document.querySelectorAll(`.schedule-pill[data-person-type="${personType}"]`);
    const cells = document.querySelectorAll(`#${personType}-calendar-container .schedule-shift-cell`);
    let draggedPill = null;
    
    pills.forEach(pill => {
        pill.addEventListener('dragstart', (e) => {
            if (pill.classList.contains('vacation')) {
                e.preventDefault();
                return;
            }
            draggedPill = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
            const sourceCell = draggedPill.parentElement;
            e.dataTransfer.setData('text/plain', JSON.stringify({
                personId: draggedPill.dataset.personId,
                personType: draggedPill.dataset.personType,
                sourceDate: sourceCell.dataset.date,
                sourceShift: sourceCell.dataset.shift
            }));
        });
        pill.addEventListener('dragend', () => {
             if(draggedPill) draggedPill.classList.remove('dragging');
             draggedPill = null;
        });
    });
    
    cells.forEach(cell => {
        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            cell.classList.add('drag-over');
        });
         cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
         cell.addEventListener('drop', (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over');
            if (!draggedPill) return;

            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const { personId, sourceDate, sourceShift } = data;
            const targetDate = cell.dataset.date;
            const targetShift = cell.dataset.shift;
            
            if (isPersonOnVacation(personType, personId, targetDate)) {
                alert('Nelze přiřadit. Osoba má na tento den dovolenou.');
                return;
            }
            
            let schedule = personType === 'foreman' ? employeeState.foremenSchedule : employeeState.forkliftSchedule;

            if (sourceDate) {
                if (schedule[sourceDate] && schedule[sourceDate][sourceShift]) {
                    schedule[sourceDate][sourceShift] = schedule[sourceDate][sourceShift].filter(id => id != personId);
                }
            }
            
            if (!schedule[targetDate]) {
                schedule[targetDate] = { morning: [], afternoon: [], night: [] };
            }
            if (!schedule[targetDate][targetShift].includes(personId)) {
                 schedule[targetDate][targetShift].push(personId);
            }
            
            saveDataToLocalStorage();
            renderScheduleCalendar(personType);
         });
    });
};

export const openAssignPersonToWeekModal = (personType, weekStartDateStr, weekNum) => {
    const modal = document.getElementById(`assign-${personType === 'foreman' ? 'foreman' : 'forklift-driver'}-week-modal`);
    const title = modal.querySelector('h2');
    const select = modal.querySelector('select[id$="-week-select"]');
    const people = personType === 'foreman' ? employeeState.foremen : employeeState.forkliftDrivers;

    modal.querySelector('input[type="hidden"]').value = weekStartDateStr;
    title.textContent = `Přiřadit na celý ${weekNum}. týden`;

    select.innerHTML = '<option value="" disabled selected>Vyberte...</option>';
    people.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.firstName} ${p.lastName}`;
        select.appendChild(option);
    });
    
    const weekStartDate = new Date(weekStartDateStr);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    modal.querySelector('input[id$="-vacation-start-date"]').value = weekStartDateStr;
    modal.querySelector('input[id$="-vacation-end-date"]').value = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}-${String(weekEndDate.getDate()).padStart(2, '0')}`;

    openModal(modal);
};

export const openAddPersonModal = (personType, person = null) => {
    const modal = document.getElementById(`add-${personType === 'foreman' ? 'foreman' : 'forklift-driver'}-modal`);
    const form = modal.querySelector('form');
    form.reset();
    if (person) {
         modal.querySelector('h2').textContent = `Upravit ${personType === 'foreman' ? 'předního dělníka' : 'vozíčkáře'}`;
         modal.querySelector('input[type="hidden"]').value = person.id;
         modal.querySelector('input[id$="-firstName"]').value = person.firstName;
         modal.querySelector('input[id$="-lastName"]').value = person.lastName;
         modal.querySelector('input[id$="-chip"]').value = person.chip;
         modal.querySelector('input[id$="-phone"]').value = person.phone;
    } else {
         modal.querySelector('h2').textContent = `Přidat ${personType === 'foreman' ? 'předního dělníka' : 'vozíčkáře'}`;
         modal.querySelector('input[type="hidden"]').value = '';
    }
    openModal(modal);
};

export const renderPeopleList = (personType) => {
    const modal = document.getElementById(`${personType === 'foreman' ? 'foremen' : 'forklift-drivers'}-list-modal`);
    const content = modal.querySelector('[id$="-list-content"]');
    const people = personType === 'foreman' ? employeeState.foremen : employeeState.forkliftDrivers;
    content.innerHTML = '';
     if (people.length === 0) {
        content.innerHTML = `<p>Nebyly nalezeny žádní ${personType === 'foreman' ? 'přední dělníci' : 'vozíčkáři'}.</p>`;
        return;
    }
    people.forEach((p) => {
        content.innerHTML += `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <div>
                    <p class="font-bold">${p.firstName} ${p.lastName}</p>
                    <p class="text-sm text-slate-500">Čip: ${p.chip || 'N/A'}</p>
                </div>
                <div class="flex gap-2">
                    <button class="edit-person-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200" data-person-type="${personType}" data-id="${p.id}"><i data-feather="edit"></i></button>
                    <button class="delete-person-btn p-1.5 rounded-full text-slate-400 hover:bg-slate-200" data-person-type="${personType}" data-id="${p.id}"><i data-feather="trash-2"></i></button>
                </div>
            </div>
        `;
    });
    feather.replace();
};
