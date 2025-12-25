
// @ts-nocheck
import { employeeState, saveDataToLocalStorage, loadDataFromLocalStorage, monthNames } from '../employees/state.ts';
import { openModal, closeModal, updateEmployeeLocationSelect } from '../employees/ui.ts';
import { renderCalendar, updateDeparturesInfo, updateUnknownDeparturesInfo, updateShiftsView, renderLocations, renderLocationsOverview, updateEmployeeLocationSelect as updateLoc, updateAddDepartureView, renderDailyDeparturesModal, openEmployeeModal, updateAllViews, openEmployeeManagementModal } from '../employees/modules/general.ts';
import { updateRotationToggleUI, renderScheduleCalendar, openAssignPersonToWeekModal, openAddPersonModal, renderPeopleList } from '../employees/modules/scheduling.ts';
import { renderHoursView, openAddHoursModal, openWriteOffHoursModal } from '../employees/modules/hours.ts';
import { openExportDeparturesModal, addExportMonth, generateDeparturesExcel } from '../employees/modules/export.ts';

export function initEmployeesApp() {
    feather.replace();

    // --- SHARED & GENERAL ---
    const mainView = document.getElementById('main-view');
    const foremenView = document.getElementById('foremen-view');
    const forkliftView = document.getElementById('forklift-view');
    const hoursView = document.getElementById('hours-view');
    const monthYearEls = document.querySelectorAll('.month-year-display');
    const prevMonthBtns = document.querySelectorAll('.prev-month-btn');
    const nextMonthBtns = document.querySelectorAll('.next-month-btn');
    
    const setActiveView = (viewToShow) => {
         [mainView, foremenView, forkliftView, hoursView].forEach(view => {
            if (view.id === viewToShow) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        });

        const year = employeeState.currentDate.getFullYear();
        const month = employeeState.currentDate.getMonth();
        monthYearEls.forEach(el => el.textContent = `${monthNames[month]} ${year}`);

        if (viewToShow === 'main-view') renderCalendar();
        else if (viewToShow === 'foremen-view') {
            updateRotationToggleUI('foreman', employeeState.foremanRotationEnabled);
            renderScheduleCalendar('foreman');
        }
        else if (viewToShow === 'forklift-view') {
            updateRotationToggleUI('forklift', employeeState.forkliftRotationEnabled);
            renderScheduleCalendar('forklift');
        }
        else if (viewToShow === 'hours-view') renderHoursView();
    }

    // --- EVENT LISTENERS (Binding) ---

    // Navigation
    prevMonthBtns.forEach(btn => btn.addEventListener('click', () => {
        employeeState.currentDate.setMonth(employeeState.currentDate.getMonth() - 1);
        const activeView = document.querySelector('#main-view:not(.hidden), #foremen-view:not(.hidden), #forklift-view:not(.hidden), #hours-view:not(.hidden)');
        setActiveView(activeView.id);
    }));

    nextMonthBtns.forEach(btn => btn.addEventListener('click', () => {
        employeeState.currentDate.setMonth(employeeState.currentDate.getMonth() + 1);
        const activeView = document.querySelector('#main-view:not(.hidden), #foremen-view:not(.hidden), #forklift-view:not(.hidden), #hours-view:not(.hidden)');
        setActiveView(activeView.id);
    }));

    // Sidebar & Data I/O
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const closeSidebarBtn = document.getElementById('close-sidebar-button');
    
    const openSidebar = () => {
        sidebarOverlay.classList.remove('hidden');
        sidebar.classList.remove('translate-x-full');
    };
    const closeSidebar = () => {
        sidebarOverlay.classList.add('hidden');
        sidebar.classList.add('translate-x-full');
    };
    sidebarToggleBtn?.addEventListener('click', openSidebar);
    closeSidebarBtn?.addEventListener('click', closeSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Import/Export
    document.getElementById('save-data-button')?.addEventListener('click', () => {
        const dataStr = localStorage.getItem('shiftCalendarData_v2.5') || '{}';
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kalendar_data_export.json';
        a.click();
        URL.revokeObjectURL(url);
        alert("Data byla úspěšně exportována!");
    });
    
    const loadDataInput = document.getElementById('load-data-input');
    loadDataInput?.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const contents = await file.text();
            JSON.parse(contents); 
            localStorage.setItem('shiftCalendarData_v2.5', contents);
            loadDataFromLocalStorage(); 
            alert("Data byla úspěšně importována.");
            const activeView = document.querySelector('#main-view:not(.hidden), #foremen-view:not(.hidden), #forklift-view:not(.hidden), #hours-view:not(.hidden)');
            setActiveView(activeView ? activeView.id : 'main-view');
        } catch (err) {
            console.error('Chyba:', err);
            alert('Chyba importu.');
        }
        event.target.value = '';
    });
    document.querySelector('label[for="load-data-input"]')?.addEventListener('click', () => loadDataInput.click());

    // View Switching
    document.getElementById('show-foremen-view')?.addEventListener('click', () => { setActiveView('foremen-view'); closeSidebar(); });
    // NEW LISTENER FOR HEADER BUTTON
    document.getElementById('show-foremen-view-header')?.addEventListener('click', () => setActiveView('foremen-view'));
    document.getElementById('show-forklift-view-header')?.addEventListener('click', () => setActiveView('forklift-view'));
    
    document.getElementById('show-forklift-view')?.addEventListener('click', () => { setActiveView('forklift-view'); closeSidebar(); });
    document.getElementById('show-hours-view')?.addEventListener('click', () => { setActiveView('hours-view'); closeSidebar(); });
    document.getElementById('back-to-main-view-foreman')?.addEventListener('click', () => setActiveView('main-view'));
    document.getElementById('back-to-main-view-forklift')?.addEventListener('click', () => setActiveView('main-view'));
    document.getElementById('back-to-main-view-hours')?.addEventListener('click', () => setActiveView('main-view'));

    // --- Settings Menu Toggle Logic ---
    const settingsToggleBtn = document.getElementById('employee-settings-toggle');
    const settingsDropdown = document.getElementById('employee-settings-dropdown');

    if (settingsToggleBtn && settingsDropdown) {
        settingsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsDropdown.contains(e.target) && !settingsToggleBtn.contains(e.target)) {
                settingsDropdown.classList.add('hidden');
            }
        });
        
        // Also close when clicking any button inside the dropdown
        settingsDropdown.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                settingsDropdown.classList.add('hidden');
            }
        });
    }

    // --- General Modals ---
    const addEmployeeModal = document.getElementById('add-employee-modal');
    const shiftsModal = document.getElementById('shifts-modal');
    const addDepartureModal = document.getElementById('add-departure-modal');
    const locationsModal = document.getElementById('locations-modal');
    const addEditLocationModal = document.getElementById('add-edit-location-modal');
    const dailyDeparturesModal = document.getElementById('daily-departures-modal');
    const fillDepartureModal = document.getElementById('fill-departure-modal');
    const exportDeparturesModal = document.getElementById('export-departures-modal');
    const employeeManagementModal = document.getElementById('employee-management-modal');

    document.getElementById('open-add-employee-modal')?.addEventListener('click', () => openEmployeeModal());
    document.getElementById('close-add-employee-modal')?.addEventListener('click', () => closeModal(addEmployeeModal));
    document.getElementById('open-shifts-modal')?.addEventListener('click', () => { updateShiftsView(); openModal(shiftsModal); });
    document.getElementById('close-shifts-modal')?.addEventListener('click', () => closeModal(shiftsModal));
    document.getElementById('open-add-departure-modal-main')?.addEventListener('click', () => { document.getElementById('add-departure-form').reset(); updateAddDepartureView(); openModal(addDepartureModal); });
    document.getElementById('close-add-departure-modal')?.addEventListener('click', () => closeModal(addDepartureModal));
    document.getElementById('open-locations-modal')?.addEventListener('click', () => { renderLocations(); openModal(locationsModal); });
    document.getElementById('close-locations-modal')?.addEventListener('click', () => closeModal(locationsModal));
    document.getElementById('cancel-add-edit-location')?.addEventListener('click', () => closeModal(addEditLocationModal));
    document.getElementById('close-daily-departures-modal')?.addEventListener('click', () => closeModal(dailyDeparturesModal));
    document.getElementById('close-fill-departure-modal')?.addEventListener('click', () => closeModal(fillDepartureModal));

    // New Buttons (Main Header)
    document.getElementById('open-add-location-modal-main')?.addEventListener('click', () => { renderLocations(); openModal(locationsModal); });
    document.getElementById('open-add-employee-modal-main')?.addEventListener('click', () => openEmployeeModal());
    
    // Employee Management Modal
    document.getElementById('open-employee-management-modal-btn')?.addEventListener('click', () => openEmployeeManagementModal());
    document.getElementById('close-employee-management-modal')?.addEventListener('click', () => closeModal(employeeManagementModal));
    document.getElementById('close-employee-management-modal-btn')?.addEventListener('click', () => closeModal(employeeManagementModal));

    // Export Departures Buttons
    document.getElementById('open-export-departures-modal')?.addEventListener('click', () => openExportDeparturesModal());
    document.getElementById('add-export-month-btn')?.addEventListener('click', () => addExportMonth());
    document.getElementById('close-export-departures-modal')?.addEventListener('click', () => closeModal(exportDeparturesModal));
    document.getElementById('confirm-export-departures-btn')?.addEventListener('click', () => generateDeparturesExcel());

    // --- Scheduling Modals ---
    document.getElementById('open-add-foreman-modal')?.addEventListener('click', () => openAddPersonModal('foreman'));
    document.getElementById('close-add-foreman-modal')?.addEventListener('click', () => closeModal(document.getElementById('add-foreman-modal')));
    document.getElementById('open-foremen-list-modal')?.addEventListener('click', () => { renderPeopleList('foreman'); openModal(document.getElementById('foremen-list-modal')); });
    document.getElementById('close-foremen-list-modal')?.addEventListener('click', () => closeModal(document.getElementById('foremen-list-modal')));
    document.getElementById('close-assign-foreman-week-modal')?.addEventListener('click', () => closeModal(document.getElementById('assign-foreman-week-modal')));
    document.getElementById('close-weekend-foreman-modal')?.addEventListener('click', () => closeModal(document.getElementById('weekend-foreman-modal')));
    
    document.getElementById('open-add-forklift-driver-modal')?.addEventListener('click', () => openAddPersonModal('forklift'));
    document.getElementById('close-add-forklift-driver-modal')?.addEventListener('click', () => closeModal(document.getElementById('add-forklift-driver-modal')));
    document.getElementById('open-forklift-drivers-list-modal')?.addEventListener('click', () => { renderPeopleList('forklift'); openModal(document.getElementById('forklift-drivers-list-modal')); });
    document.getElementById('close-forklift-drivers-list-modal')?.addEventListener('click', () => closeModal(document.getElementById('forklift-drivers-list-modal')));
    document.getElementById('close-assign-forklift-driver-week-modal')?.addEventListener('click', () => closeModal(document.getElementById('assign-forklift-driver-week-modal')));
    document.getElementById('close-weekend-forklift-driver-modal')?.addEventListener('click', () => closeModal(document.getElementById('weekend-forklift-driver-modal')));

    // --- Hours Modals ---
    const addHoursModal = document.getElementById('add-hours-modal');
    const hoursSettingsModal = document.getElementById('hours-settings-modal');
    const writeOffHoursModal = document.getElementById('write-off-hours-modal');
    const reasonModal = document.getElementById('reason-modal');

    document.getElementById('open-add-hours-modal')?.addEventListener('click', () => openAddHoursModal());
    document.getElementById('close-add-hours-modal')?.addEventListener('click', () => closeModal(addHoursModal));
    document.getElementById('open-hours-settings-modal')?.addEventListener('click', () => { 
        document.getElementById('optimal-tons-per-hour').value = employeeState.hoursSettings.optimal_tons_per_hour; 
        document.getElementById('performance-calculation-method').value = employeeState.hoursSettings.calculation_method || 'tons_per_hour'; 
        openModal(hoursSettingsModal); 
    });
    document.getElementById('close-hours-settings-modal')?.addEventListener('click', () => closeModal(hoursSettingsModal));
    document.getElementById('open-write-off-hours-modal')?.addEventListener('click', () => openWriteOffHoursModal());
    document.getElementById('close-write-off-hours-modal')?.addEventListener('click', () => closeModal(writeOffHoursModal));
    document.getElementById('close-reason-modal')?.addEventListener('click', () => closeModal(reasonModal));


    // --- FORM SUBMISSIONS ---
    // Prevent Default
    ['add-employee-form', 'add-departure-form', 'fill-departure-form', 'add-edit-location-form', 
     'add-hours-form', 'hours-settings-form', 'write-off-hours-form'].forEach(id => {
        document.getElementById(id)?.addEventListener('submit', e => e.preventDefault());
    });

    // Add Employee
    document.getElementById('add-employee-form').onsubmit = (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('employee-id').value;
        const employeeData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            chip: document.getElementById('chip').value,
            shift: document.getElementById('shift').value,
            gender: document.getElementById('gender').value,
            locationId: document.getElementById('location').value,
            departureDate: document.getElementById('departureDate').value,
        };

        if (employeeId) {
            const index = employeeState.employees.findIndex(emp => emp.id == employeeId);
            if (index !== -1) employeeState.employees[index] = { ...employeeState.employees[index], ...employeeData };
        } else {
            employeeState.employees.push({ id: Date.now(), ...employeeData });
        }
        saveDataToLocalStorage();
        document.getElementById('add-employee-form').reset();
        closeModal(addEmployeeModal);
        updateAllViews();
        // Also refresh management modal if open, although typically modal closes on save
        openEmployeeManagementModal(); 
        renderCalendar();
    };

    // Add Departure
    document.getElementById('add-departure-form').onsubmit = (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('departure-employee-select').value;
        const newDate = document.getElementById('newDepartureDate').value;
        if (!employeeId || !newDate) return;
        const employee = employeeState.employees.find(emp => emp.id == employeeId);
        if(employee) employee.departureDate = newDate;
        saveDataToLocalStorage();
        document.getElementById('add-departure-form').reset();
        closeModal(addDepartureModal);
        updateAllViews();
        renderCalendar();
    };

    // Fill Departure
    document.getElementById('fill-departure-form').onsubmit = (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('fill-departure-employee-id').value;
        const newDate = document.getElementById('fill-departure-date').value;
        const employee = employeeState.employees.find(emp => emp.id == employeeId);
        if (employee) employee.departureDate = newDate;
        saveDataToLocalStorage();
        closeModal(fillDepartureModal);
        updateAllViews();
        renderCalendar();
    };

    // Locations
    document.getElementById('add-edit-location-form').onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('location-id').value;
        const name = document.getElementById('location-name').value;
        
        if (!name || name.trim() === "") return;

        if (id) {
            const location = employeeState.workLocations.find(l => l.id == id);
            if (location) location.name = name;
        } else {
            employeeState.workLocations.push({ id: Date.now(), name: name });
        }
        saveDataToLocalStorage();
        closeModal(addEditLocationModal);
        
        // CRITICAL FIX: Explicitly render locations to update the list in the modal
        renderLocations();
        updateAllViews();
        openEmployeeManagementModal(); // Refresh dropdowns in management modal
    };

    // Hours
    document.getElementById('add-hours-form').onsubmit = (e) => {
        e.preventDefault();
        const date = document.getElementById('hours-date').value;
        const data = {
            hours: document.getElementById('hours-worked').value,
            bizzerba_kg: document.getElementById('hours-bizzerba-kg').value,
            netto_kg: document.getElementById('hours-netto-kg').value,
        };
        employeeState.hoursData[date] = data;
        saveDataToLocalStorage();
        closeModal(addHoursModal);
        renderHoursView();
    };

    document.getElementById('hours-settings-form').onsubmit = (e) => {
        e.preventDefault();
        employeeState.hoursSettings.optimal_tons_per_hour = parseFloat(document.getElementById('optimal-tons-per-hour').value);
        employeeState.hoursSettings.calculation_method = document.getElementById('performance-calculation-method').value;
        saveDataToLocalStorage();
        closeModal(hoursSettingsModal);
        renderHoursView();
    };

    document.getElementById('write-off-hours-form').onsubmit = e => {
        e.preventDefault();
        const id = document.getElementById('write-off-id').value;
        const chip = document.getElementById('write-off-chip').value;
        const employee = employeeState.employees.find(emp => emp.chip && emp.chip === chip);

        if (!employee) {
            alert('Zaměstnanec s tímto čipem nebyl nalezen.');
            return;
        }
        
        const writeOffData = {
            employeeId: employee.id,
            date: document.getElementById('write-off-date').value,
            hours: document.getElementById('write-off-hours').value,
            reason: document.getElementById('write-off-reason').value
        };

        if (id) {
            const index = employeeState.hoursWriteOffs.findIndex(wo => wo.id == id);
            if (index > -1) employeeState.hoursWriteOffs[index] = { ...employeeState.hoursWriteOffs[index], ...writeOffData };
        } else {
            employeeState.hoursWriteOffs.push({ id: Date.now(), ...writeOffData });
        }
        saveDataToLocalStorage();
        closeModal(writeOffHoursModal);
        renderHoursView();
    };

    // --- GLOBAL DELEGATION (Event Handling on View) ---
    const employeeView = document.getElementById('view-employees');
    if (employeeView) {
        employeeView.addEventListener('change', (e) => {
            // Location Change in Management Modal
            if (e.target.classList.contains('manage-location-select')) {
                const empId = e.target.dataset.id;
                const newLocationId = e.target.value;
                const employee = employeeState.employees.find(emp => emp.id == empId);
                if (employee) {
                    employee.locationId = newLocationId;
                    saveDataToLocalStorage();
                    updateAllViews();
                }
            }
        });

        employeeView.addEventListener('click', (e) => {
            // Management Modal Actions
            if (e.target.closest('.manage-edit-btn')) {
                const id = e.target.closest('.manage-edit-btn').dataset.id;
                const employee = employeeState.employees.find(emp => emp.id == id);
                if (employee) openEmployeeModal(employee);
            }
            if (e.target.closest('.manage-delete-btn')) {
                const id = e.target.closest('.manage-delete-btn').dataset.id;
                if(confirm('Opravdu smazat zaměstnance?')) {
                    employeeState.employees = employeeState.employees.filter(emp => emp.id != id);
                    saveDataToLocalStorage();
                    updateAllViews();
                    openEmployeeManagementModal(); // Refresh the list
                }
            }

            // Employee Deletion (Shift View)
            if (e.target.closest('.delete-employee-shift-btn')) {
                const id = e.target.closest('.delete-employee-shift-btn').dataset.id;
                if(confirm('Opravdu smazat?')) {
                    employeeState.employees = employeeState.employees.filter(emp => emp.id != id);
                    saveDataToLocalStorage();
                    updateAllViews();
                }
            }
            // Calendar Day Click
            if (e.target.closest('.departure-count')) {
                renderDailyDeparturesModal(e.target.closest('.departure-count').dataset.date);
            }
            // Edit Employee
            if (e.target.closest('.edit-employee-btn')) {
                const employee = employeeState.employees.find(emp => emp.id == e.target.closest('.edit-employee-btn').dataset.id);
                if (employee) openEmployeeModal(employee);
            }
            // Delete Employee (Daily Modal)
             if (e.target.closest('.delete-employee-daily-btn')) {
                const id = e.target.closest('.delete-employee-daily-btn').dataset.id;
                if(confirm('Smazat?')) {
                    employeeState.employees = employeeState.employees.filter(emp => emp.id != id);
                    saveDataToLocalStorage();
                    closeModal(dailyDeparturesModal);
                    renderCalendar();
                }
            }
            // Location Toggle
            if (e.target.closest('.location-header')) {
                const header = e.target.closest('.location-header');
                const content = header.nextElementSibling;
                const icon = header.querySelector('.location-toggle-icon');
                content.classList.toggle('max-h-0');
                icon.classList.toggle('rotate-180');
            }
            // Fill Departure
            if (e.target.closest('.fill-departure-btn')) {
                const id = e.target.closest('.fill-departure-btn').dataset.id;
                const employee = employeeState.employees.find(emp => emp.id == id);
                if (employee) {
                    document.getElementById('fill-departure-employee-id').value = id;
                    document.getElementById('fill-departure-title').textContent = `Doplnit odjezd: ${employee.firstName} ${employee.lastName}`;
                    openModal(fillDepartureModal);
                }
            }
            // Location Management (Fixing the bug)
            // This targets the button INSIDE the Locations Modal (which opens the add/edit modal)
            if (e.target.closest('#open-add-location-button')) {
                document.getElementById('add-edit-location-form').reset();
                document.getElementById('add-edit-location-title').textContent = 'Přidat nové umístění';
                document.getElementById('location-id').value = '';
                openModal(addEditLocationModal);
            }
            // Edit Location (Pencil icon)
            if (e.target.closest('.edit-location-btn')) {
                const location = employeeState.workLocations.find(loc => loc.id == e.target.closest('.edit-location-btn').dataset.id);
                if (location) {
                    document.getElementById('add-edit-location-title').textContent = 'Upravit umístění';
                    document.getElementById('location-id').value = location.id;
                    document.getElementById('location-name').value = location.name;
                    openModal(addEditLocationModal);
                }
            }
            // Delete Location
            if (e.target.closest('.delete-location-btn')) {
                const locationId = e.target.closest('.delete-location-btn').dataset.id;
                if (employeeState.employees.some(emp => emp.locationId == locationId)) {
                    alert('Nelze smazat umístění, které je přiřazeno zaměstnancům.');
                    return;
                }
                if (confirm('Opravdu chcete smazat toto umístění?')) {
                    employeeState.workLocations = employeeState.workLocations.filter(loc => loc.id != locationId);
                    saveDataToLocalStorage();
                    updateAllViews();
                }
            }
            // Hours Management
            if (e.target.closest('.edit-hours-btn')) {
                openAddHoursModal(e.target.closest('.edit-hours-btn').dataset.date);
            }
            if (e.target.closest('#delete-hours-entry-btn')) {
                const date = document.getElementById('hours-date').value;
                if (confirm(`Opravdu chcete smazat záznam pro ${date}?`)) {
                    delete employeeState.hoursData[date];
                    saveDataToLocalStorage();
                    closeModal(addHoursModal);
                    renderHoursView();
                }
            }
            if (e.target.closest('.view-reason-btn')) {
                const writeOff = employeeState.hoursWriteOffs.find(wo => wo.id == e.target.closest('.view-reason-btn').dataset.id);
                if (writeOff) {
                    document.getElementById('reason-modal-content').textContent = writeOff.reason;
                    openModal(reasonModal);
                }
            }
            if (e.target.closest('.edit-write-off-btn')) {
                const writeOff = employeeState.hoursWriteOffs.find(wo => wo.id == e.target.closest('.edit-write-off-btn').dataset.id);
                if (writeOff) openWriteOffHoursModal(writeOff);
            }
            if (e.target.closest('.delete-write-off-btn')) {
                const id = e.target.closest('.delete-write-off-btn').dataset.id;
                if (confirm('Opravdu chcete smazat tento záznam o upsání hodin?')) {
                    employeeState.hoursWriteOffs = employeeState.hoursWriteOffs.filter(wo => wo.id != id);
                    saveDataToLocalStorage();
                    renderHoursView();
                }
            }
            // Schedule/Person management... (delegated to modules or handled here)
            if (e.target.closest('.schedule-week-number')) {
                const el = e.target.closest('.schedule-week-number');
                openAssignPersonToWeekModal(el.dataset.personType, el.dataset.weekStartDate, el.dataset.weekNumber);
            }
            if (e.target.closest('.edit-person-btn')) {
                const el = e.target.closest('.edit-person-btn');
                const personType = el.dataset.personType;
                const people = personType === 'foreman' ? employeeState.foremen : employeeState.forkliftDrivers;
                const person = people.find(p => p.id == el.dataset.id);
                if (person) openAddPersonModal(personType, person);
            }
            if (e.target.closest('.delete-person-btn')) {
                const el = e.target.closest('.delete-person-btn');
                const personType = el.dataset.personType;
                const personId = el.dataset.id;
                if (confirm('Opravdu chcete smazat tuto osobu?')) {
                    if (personType === 'foreman') employeeState.foremen = employeeState.foremen.filter(p => p.id != personId);
                    else employeeState.forkliftDrivers = employeeState.forkliftDrivers.filter(p => p.id != personId);
                    saveDataToLocalStorage();
                    renderPeopleList(personType);
                    renderScheduleCalendar(personType);
                }
            }
        });

        // Context Menu
        employeeView.addEventListener('contextmenu', (e) => {
            const pill = e.target.closest('.schedule-pill');
            if (pill && !pill.classList.contains('vacation')) {
                e.preventDefault();
                const menu = document.getElementById('schedule-pill-context-menu');
                menu.style.top = `${e.pageY}px`;
                menu.style.left = `${e.pageX}px`;
                menu.classList.remove('hidden');
                menu.dataset.personType = pill.dataset.personType;
                menu.dataset.personId = pill.dataset.personId;
                menu.dataset.date = pill.dataset.date;
                menu.dataset.shift = pill.dataset.shift;
            }
        });
        
        // Input Listeners
        employeeView.addEventListener('input', (e) => {
            if (e.target.matches('#write-off-chip')) {
                const chip = e.target.value;
                const employee = employeeState.employees.find(emp => emp.chip && emp.chip === chip);
                const infoEl = document.getElementById('write-off-employee-info');
                if (employee) {
                    infoEl.innerHTML = `
                        <p><strong>Jméno:</strong> ${employee.firstName} ${employee.lastName}</p>
                        <p><strong>Umístění:</strong> ${employeeState.workLocations.find(l=>l.id == employee.locationId)?.name || 'N/A'}</p>
                    `;
                    infoEl.classList.remove('hidden');
                } else {
                    infoEl.classList.add('hidden');
                }
            }
        });
    }

    // Initial Render
    setActiveView('main-view');
}
