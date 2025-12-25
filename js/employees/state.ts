
// @ts-nocheck

export const monthNames = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];

export const employeeState = {
    currentDate: new Date(),
    employees: [],
    workLocations: [],
    foremen: [],
    foremenSchedule: {},
    foremenVacations: [],
    foremenWeekendNotes: {},
    foremanRotationEnabled: false,
    forkliftDrivers: [],
    forkliftSchedule: {},
    forkliftVacations: [],
    forkliftWeekendNotes: {},
    forkliftRotationEnabled: false,
    hoursData: {},
    hoursWriteOffs: [],
    hoursSettings: { optimal_tons_per_hour: 18, calculation_method: 'tons_per_hour' },
    exportMonths: [] // Stores {year: number, month: number} for export modal
};

export const saveDataToLocalStorage = () => {
    const dataToSave = {
        employees: employeeState.employees,
        workLocations: employeeState.workLocations,
        foremen: employeeState.foremen,
        foremenSchedule: employeeState.foremenSchedule,
        foremenVacations: employeeState.foremenVacations,
        foremenWeekendNotes: employeeState.foremenWeekendNotes,
        foremanRotationEnabled: employeeState.foremanRotationEnabled,
        forkliftDrivers: employeeState.forkliftDrivers,
        forkliftSchedule: employeeState.forkliftSchedule,
        forkliftVacations: employeeState.forkliftVacations,
        forkliftWeekendNotes: employeeState.forkliftWeekendNotes,
        forkliftRotationEnabled: employeeState.forkliftRotationEnabled,
        hoursData: employeeState.hoursData,
        hoursSettings: employeeState.hoursSettings,
        hoursWriteOffs: employeeState.hoursWriteOffs
    };
    localStorage.setItem('shiftCalendarData_v2.5', JSON.stringify(dataToSave));
};

export const loadDataFromLocalStorage = () => {
    const savedData = localStorage.getItem('shiftCalendarData_v2.5');
    if (savedData) {
        const data = JSON.parse(savedData);
        employeeState.employees = data.employees || [];
        employeeState.workLocations = data.workLocations || [];
        employeeState.foremen = data.foremen || [];
        employeeState.foremenSchedule = data.foremenSchedule || {};
        employeeState.foremenVacations = data.foremenVacations || [];
        employeeState.foremenWeekendNotes = data.foremenWeekendNotes || {};
        employeeState.foremanRotationEnabled = data.foremanRotationEnabled || false;
        employeeState.forkliftDrivers = data.forkliftDrivers || [];
        employeeState.forkliftSchedule = data.forkliftSchedule || {};
        employeeState.forkliftVacations = data.forkliftVacations || [];
        employeeState.forkliftWeekendNotes = data.forkliftWeekendNotes || {};
        employeeState.forkliftRotationEnabled = data.forkliftRotationEnabled || false;
        employeeState.hoursData = data.hoursData || {};
        employeeState.hoursSettings = data.hoursSettings || { optimal_tons_per_hour: 18, calculation_method: 'tons_per_hour' };
        employeeState.hoursWriteOffs = data.hoursWriteOffs || [];
    }
};

// Initial load
loadDataFromLocalStorage();
