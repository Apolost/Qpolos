
// @ts-nocheck
import { employeeState } from './state.ts';
export { showToast } from '../ui.ts';

// Shared DOM Elements Reference (Updated during init)
export const EmployeeDOM = {
    mainView: null,
    foremenView: null,
    forkliftView: null,
    hoursView: null,
    monthYearEls: null,
    // ... populated in init
};

export const openModal = (modal) => {
    if(modal) modal.classList.remove('hidden');
};

export const closeModal = (modal) => {
    if(modal) modal.classList.add('hidden');
};

export const updateEmployeeLocationSelect = () => {
    const select = document.getElementById('location');
    if(!select) return;
    select.innerHTML = '<option value="" disabled selected>Vyberte umístění...</option>';
    employeeState.workLocations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.id;
        option.textContent = loc.name;
        select.appendChild(option);
    });
};
