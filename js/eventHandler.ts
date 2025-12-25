
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// @ts-nocheck

import { appState, saveState, saveDataToFile, loadDataFromFile } from './state.ts';
import { changeDate, render } from './main.ts';
import { DOMElements } from './ui.ts';

// Import handlers from all component/settings modules
import * as mainPage from './components/mainPage.ts';
import * as orders from './components/orders.ts';
import * as calendar from './components/calendar.ts';
import * as kfc from './components/kfc.ts';
import * as changes from './components/changes.ts';
import * as spizy from './components/spizy.ts';
import * as modals from './components/modals.ts';
import * as calculator from './components/calculator.ts';
import * as productionOverview from './components/productionOverview.ts';
import * as rawMaterialOrders from './components/rawMaterialOrders.ts';
import * as qrCode from './components/qrCode.ts';
import * as stock from './components/stock.ts';
import * as products from './settings/products.ts';
import * as mixes from './settings/mixes.ts';
import * as boxWeights from './settings/boxWeights.ts';
import * as paletteWeights from './settings/paletteWeights.ts';
import * as customers from './settings/customers.ts';
import * as lineSettings from './settings/lineSettings.ts';
import * as exportData from './components/export.ts';
import * as monthlyOverview from './components/monthlyOverview.ts';
import * as frozenProducts from './components/frozenProducts.ts';
import * as frozen from './components/frozen.ts';
import * as importOrders from './components/importOrders.ts';
import { buildSingleHtmlApp } from './services/build.ts';
import * as notifications from './components/notifications.ts';


export function bindGlobalEvents() {
    document.body.addEventListener('click', handleGlobalClick);
    document.body.addEventListener('change', handleGlobalChange);
    document.body.addEventListener('input', handleGlobalInput);
}

async function handleGlobalClick(e) {
    const actionTarget = e.target.closest('[data-action]');
    const navLink = e.target.closest('.nav-link');
    const menuToggle = e.target.closest('#menu-toggle');
    const navOverlay = e.target.closest('#nav-overlay');

    // --- Navigation ---
    if (menuToggle) {
        document.getElementById('app-nav').classList.toggle('open');
        document.getElementById('nav-overlay').classList.toggle('active');
    } else if (navOverlay || navLink) {
        document.getElementById('app-nav').classList.remove('open');
        document.getElementById('nav-overlay').classList.remove('active');
    }

    // --- View Switching from Nav ---
    if (navLink && navLink.dataset.view) {
        e.preventDefault();
        appState.ui.activeView = navLink.dataset.view;
        render();
    }

    if (actionTarget) {
        e.preventDefault();
        const { action, id } = actionTarget.dataset;

        if (action === 'dismiss-notification') {
            const notification = e.target.closest('.shortage-notification');
            if (notification) {
                if (notification.id === 'tray-shortage-notification') {
                    appState.ui.trayNotificationDismissed = true;
                }
                notification.style.display = 'none';
            }
            return;
        }
    
        switch (action) {
            case 'logout':
                sessionStorage.removeItem('dzControlAuth');
                window.location.reload();
                break;

            case 'save-data-to-file': saveDataToFile(); break;
            case 'load-data-from-file': loadDataFromFile(); break;
            case 'build-app-html': buildSingleHtmlApp(); break;
            
            case 'prev-day': changeDate(-1); break;
            case 'next-day': changeDate(1); break;

            case 'go-to-view':
                const viewTarget = actionTarget.dataset.viewTarget;
                if (viewTarget) {
                    appState.ui.activeView = viewTarget;
                    render();
                }
                const openModal = actionTarget.closest('.modal');
                if (openModal) openModal.classList.remove('active');
                break;

            case 'open-frozen-main-modal':
                frozen.openFrozenMainModal();
                DOMElements.productionActionsModal.classList.remove('active');
                break;
            case 'quick-entry-done': mainPage.toggleQuickEntryDone(id); break;
            case 'toggle-spizy-done': mainPage.toggleSpizyDone(actionTarget); break;
            case 'toggle-main-page-order-item-done': mainPage.toggleMainPageOrderItemDone(actionTarget); break;
            case 'delete-main-page-order-item': mainPage.deleteOrderItemFromMainPage(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
            case 'open-pre-production-modal': mainPage.openPreProductionModal(); break;
            case 'produce-from-plan': await mainPage.produceFromPlan(actionTarget); break;
            case 'set-pre-production-days': mainPage.setPreProductionDays(actionTarget); break;
            case 'open-temp-weight-modal': mainPage.openTempWeightModal(actionTarget); break;
            case 'apply-suggested-weight': mainPage.applySuggestedWeight(actionTarget); break;
            case 'save-temp-weights': mainPage.saveTempWeights(actionTarget); break;
            case 'open-surovina-shortage-modal': mainPage.openSurovinaShortageModal(actionTarget.dataset.surovinaId); break;
            case 'mark-shortage-item-done': mainPage.markShortageItemDone(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
            case 'open-shorten-order-modal': mainPage.openShortenOrderModal(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
            case 'save-shortened-order': mainPage.saveShortenedOrder(); break;
            case 'open-single-stock-adjustment': mainPage.openSingleStockAdjustmentModal(actionTarget.dataset.surovinaId); break;
            case 'save-single-stock-adjustment': mainPage.saveSingleStockAdjustment(); break;
            case 'dismiss-price-change-alert': mainPage.dismissPriceChangeAlert(id); break;
            case 'open-add-pre-production-modal': 
                mainPage.openAddPreProductionModal();
                DOMElements.preProductionModal.classList.remove('active');
                break;
            case 'save-direct-pre-production': mainPage.saveDirectPreProduction(); break;
            case 'mark-pre-production-done': mainPage.markPreProductionDone(actionTarget); break;
            case 'open-rizky-quick-calc': modals.openRizkyQuickCalcModal(); break; 
            case 'open-needs-breakdown': mainPage.openNeedsBreakdownModal(actionTarget.dataset.surovinaId); break;

            case 'export-production-pdf': productionOverview.exportProductionOverviewToPdf(); break;
            case 'open-chicken-count-modal': productionOverview.openChickenCountModal(); break;
            case 'add-chicken-flock': productionOverview.addChickenFlockRow(); break;
            case 'delete-chicken-flock': productionOverview.deleteChickenFlockRow(actionTarget); break;
            case 'save-chicken-count': productionOverview.saveChickenCount(); break;
            case 'open-pause-modal': productionOverview.openPauseModal(); break;
            case 'save-pause': productionOverview.savePause(); break;
            case 'open-breakdown-modal': productionOverview.openBreakdownModal(); break;
            case 'save-breakdown': productionOverview.saveBreakdown(); break;
            case 'delete-production-event': productionOverview.deleteProductionEvent(id); break;
            case 'delete-production-flock': productionOverview.deleteProductionFlock(actionTarget.dataset.index); break;
            case 'open-batch-reduction-modal': productionOverview.openBatchReductionModal(); break;
            case 'save-batch-reduction': productionOverview.saveBatchReduction(); break;
            case 'set-rizky-overview-range': productionOverview.renderRizkyOverview(actionTarget.dataset.range); break;
            case 'open-surovina-overview-modal': productionOverview.openSurovinaOverviewModal(); break;
            case 'transfer-stock-to-tomorrow': productionOverview.transferStockToTomorrow(); break;
            case 'set-parts-chart-view': 
                appState.ui.partsChartType = actionTarget.dataset.view;
                productionOverview.renderProductionOverview(); 
                break;

            case 'open-material-estimate-modal': monthlyOverview.openAddEstimateModal(); break;
            case 'save-material-estimate': monthlyOverview.saveMaterialEstimate(); break;
            case 'generate-auto-estimate': monthlyOverview.generateAutomaticEstimate(); break;
            case 'generate-calendar-estimate': monthlyOverview.generateCalendarEstimate(); break;
            case 'clear-material-estimates': monthlyOverview.clearEstimates(); break;
            case 'open-chicken-estimate-modal': monthlyOverview.openChickenEstimateModal(); break;
            case 'save-chicken-estimates': monthlyOverview.saveChickenEstimates(); break;
            case 'prev-month-chicken-estimate': monthlyOverview.changeChickenEstimateMonth(-1); break;
            case 'next-month-chicken-estimate': monthlyOverview.changeChickenEstimateMonth(1); break;

            case 'export-orders-pdf': orders.exportOrdersToPdf(); break;
            case 'add-order-items': orders.openAddOrderModal(id, actionTarget.dataset.orderType); break;
            case 'delete-order-item': orders.deleteOrderItem(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
            case 'edit-mix-ratio': orders.openMixRatioModal(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
            case 'move-order-item': orders.moveOrderItem(actionTarget.dataset.orderId, actionTarget.dataset.itemId, actionTarget.dataset.direction); break;
            case 'toggle-item-active': orders.toggleOrderItemActive(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
            case 'add-main-order': orders.openAddMainOrderModal(actionTarget.dataset.orderCategory); break;
            case 'save-added-items': orders.saveAddedItems(); break;
            case 'save-main-order': orders.saveMainOrder(); break;
            case 'save-mix-ratio': orders.saveMixRatio(); break;
            case 'open-quick-order-modal': orders.openQuickOrderModal(actionTarget.dataset.customerId); break;
            case 'save-quick-order': orders.saveQuickOrder(); break;
            
            case 'open-import-orders-modal': importOrders.openImportOrdersModal(); break;
            case 'open-classify-modal': importOrders.openClassifyModal(actionTarget.dataset.code); break;
            case 'save-product-classification': importOrders.saveProductClassification(); break;
            case 'confirm-import-orders': importOrders.confirmImportOrders(); break;
            case 'open-mappings-modal': importOrders.openMappingsModal(); break;
            case 'delete-mapping': importOrders.deleteMapping(actionTarget.dataset.code); break;
            case 'open-sortiment-numbers-modal': importOrders.openSortimentNumbersModal(); break;
            case 'open-add-sortiment-number-modal': importOrders.openAddSortimentNumberModal(); break;
            case 'save-sortiment-number': importOrders.saveSortimentNumber(); break;

            case 'prev-month': calendar.changeMonth(-1); break;
            case 'next-month': calendar.changeMonth(1); break;
            case 'open-day-details': calendar.openDayDetailsModal(actionTarget.dataset.date); break;
            case 'plan-action': calendar.openPlanActionModal(); break;
            case 'edit-action': calendar.openPlanActionModal(id); break;
            case 'delete-action': calendar.deletePlannedAction(id); break;
            case 'save-planned-action': calendar.savePlannedAction(); break;
            case 'open-export-actions-modal': calendar.openExportActionsModal(); break;
            case 'add-month-to-export': calendar.addMonthToExport(); break;
            case 'export-actions-to-pdf': calendar.exportActionsToPdf(); break;
            
            case 'add-change': changes.openAddChangeModal(); break;
            case 'edit-change': changes.openAddChangeModal(id); break;
            case 'delete-change': changes.deleteChange(id); break;
            case 'save-change': changes.saveChange(); break;
            case 'add-price-change': changes.openPriceChangeModal(); break;
            case 'edit-price-change': changes.openPriceChangeModal(id); break;
            case 'delete-price-change': changes.deletePriceChange(id); break;
            case 'save-price-change': changes.savePriceChange(); break;

            case 'export-calculator-pdf': calculator.exportCalculatorToPdf(); break;
            case 'open-calculator-add-item-modal': calculator.openAddItemModal(); break;
            case 'save-calculator-item': calculator.saveItem(); break;
            case 'delete-calculator-item': calculator.deleteItem(id); break;

            case 'export-raw-material-orders-pdf': rawMaterialOrders.exportRawMaterialOrdersToPdf(); break;
            case 'export-raw-materials-report': exportData.exportRawMaterialsReport(); break;
            case 'export-schnitzel-report': exportData.exportSchnitzelReport(); break;
            case 'export-kfc-report': exportData.exportKfcReport(); break;

            case 'generate-qr-code': qrCode.handleGenerateQrCode(); break;
            case 'start-qr-scan': qrCode.handleStartQrScan(); break;
            case 'stop-qr-scan': qrCode.handleStopQrScan(); break;
            case 'scan-for-removal': qrCode.handleScanForRemoval(); break;
            case 'start-add-to-stock': qrCode.handleStartAddToStock(); break;
            case 'select-surovina-for-qr': qrCode.handleSelectSurovinaForQr(actionTarget.dataset.surovinaId, actionTarget.dataset.surovinaName); break;
            case 'show-qr-code': qrCode.handleShowQrCode(id); break;
            case 'delete-qr-code': qrCode.handleDeleteQrCode(id); break;
            case 'print-qr-code': qrCode.handlePrintQrCode(id, actionTarget.dataset.surovinaName); break;

            case 'open-box-settings': stock.openBoxSettingsModal(); break;
            case 'save-box-assignments': stock.handleSaveBoxAssignments(); break;
            case 'save-box-type': stock.handleSaveBoxType(); break;
            case 'edit-box-type': stock.handleEditBoxType(id); break;
            case 'delete-box-type': stock.handleDeleteBoxType(id); break;
            case 'cancel-edit-box-type': stock.handleCancelEditBoxType(); break;

            case 'open-tray-settings': stock.openTraySettingsModal(); break;
            case 'save-tray-assignments': stock.handleSaveTrayAssignments(); break;
            case 'save-tray-type': stock.handleSaveTrayType(); break;
            case 'edit-tray-type': stock.handleEditTrayType(id); break;
            case 'delete-tray-type': stock.handleDeleteTrayType(id); break;
            case 'cancel-edit-tray-type': stock.handleCancelEditTrayType(); break;
            case 'open-tray-stock-modal': stock.openTrayStockModal(); break;
            case 'save-tray-stock': stock.saveTrayStock(); break;
            case 'open-tray-pallet-settings-modal': stock.openTrayPalletSettingsModal(); break;
            case 'save-tray-pallet-settings': stock.saveTrayPalletSettings(); break;

            case 'save-customer': customers.saveCustomer(); break;
            case 'edit-customer': customers.openCustomerEditor(id); break;
            case 'delete-customer': customers.deleteCustomer(id); break;
            case 'cancel-edit-customer': customers.cancelEditCustomer(); break;
            case 'save-all-customers': customers.saveAllCustomers(); break;

            case 'edit-product': products.openProductEditor(id); break;
            case 'delete-product': products.deleteProduct(id); break;
            case 'toggle-product-active': products.toggleProductActive(id); break;
            case 'save-caliber': products.saveCaliberAsSurovina(); break;
            case 'save-new-prod': products.saveNewProd(); break;
            case 'cancel-edit-prod': products.cancelEditProd(); break;
            
            case 'delete-new-product-component': mixes.deleteNewProductComponent(actionTarget); break;
            case 'edit-mix': mixes.openMixEditor(id); break;
            case 'delete-mix': mixes.deleteMix(id); break;
            case 'add-new-product-component': mixes.renderNewProductComponents(true); break;
            case 'save-new-product': mixes.saveNewProduct(); break;
            case 'cancel-edit-mix': mixes.cancelEditMix(); break;

            case 'open-add-frozen-product-modal': frozenProducts.openAddFrozenProductModal(); break;
            case 'save-frozen-product': frozenProducts.saveFrozenProduct(); break;
            case 'edit-frozen-product': frozenProducts.openAddFrozenProductModal(id); break;
            case 'delete-frozen-product': frozenProducts.deleteFrozenProduct(id); break;
            case 'cancel-edit-frozen-product': frozenProducts.cancelEditFrozenProduct(); break;

            case 'toggle-box-weight-product-active': boxWeights.toggleBoxWeightProductActive(actionTarget.dataset.customerId, actionTarget.dataset.surovinaId); break;
            case 'save-all-box-weights': boxWeights.saveAllBoxWeights(); break;

            case 'save-all-palette-weights': paletteWeights.saveAllPaletteWeights(); break;

            case 'save-line-settings': lineSettings.saveLineSettings(); break;
            case 'open-calibration-source-modal': lineSettings.openCalibrationSourceModal(); break;
            case 'open-calibration-setup-modal': lineSettings.openCalibrationSetupModal(actionTarget.dataset.type); break;
            case 'save-calibration-settings': lineSettings.saveCalibrationSettings(); break;
            case 'open-yield-settings-modal': lineSettings.openYieldSettingsModal(); break;
            case 'save-yield-settings': lineSettings.saveYieldSettings(); break;
            case 'open-thigh-split-settings-modal': lineSettings.openThighSplitSettingsModal(); break;
            case 'save-thigh-split-settings': lineSettings.saveThighSplitSettings(); break;
            case 'open-portioning-settings-modal': lineSettings.openPortioningSettingsModal(); break;
            case 'save-portioning-settings': lineSettings.savePortioningSettings(); break;
            case 'open-intelligent-settings-modal': lineSettings.openIntelligentSettingsModal(); break;
            
            case 'open-kfc-add-order': kfc.openKfcAddOrderModal(); break;
            case 'open-kfc-stock': kfc.openKfcStockModal(); break;
            case 'open-kfc-staff-modal': kfc.openKfcStaffModal(); break;
            case 'save-kfc-products': kfc.saveKfcProducts(); break;
            case 'save-kfc-order': kfc.saveKfcOrder(); break;
            case 'save-kfc-stock': kfc.saveKfcStock(); break;
            case 'save-kfc-staff': kfc.saveKfcStaff(); break;

            case 'open-spizy-modal':
                spizy.openSpizyModal();
                DOMElements.productionActionsModal.classList.remove('active');
                break;
            case 'open-spizy-add-order-modal': spizy.openSpizyAddOrderModal(); break;
            case 'edit-spizy-order': spizy.openSpizyAddOrderModal(id); break;
            case 'delete-spizy-order': spizy.deleteSpizyOrder(id); break;
            case 'open-spizy-stock-modal': spizy.openSpizyStockModal(); break;
            case 'open-spizy-ingredient-order-modal': spizy.openSpizyIngredientOrderModal(); break;
            case 'edit-spizy-ingredient-order': spizy.openSpizyIngredientOrderModal(id); break;
            case 'delete-spizy-ingredient-order': spizy.deleteSpizyIngredientOrder(id); break;
            case 'save-spizy-order': spizy.saveSpizyOrder(); break;
            case 'save-spizy-stock': spizy.saveSpizyStock(); break;
            case 'save-spizy-settings': spizy.saveSpizySettings(); break;
            case 'save-spizy-ingredient-order': spizy.saveSpizyIngredientOrder(); break;
            
            case 'open-add-frozen-request-modal': frozen.openAddFrozenRequestModal(); break;
            case 'save-frozen-request': frozen.saveFrozenRequest(); break;
            case 'delete-frozen-order': frozen.deleteFrozenOrder(id); break;
            case 'save-frozen-production': frozen.saveFrozenProduction(); break;

            case 'open-production-modal': modals.openProductionModal(); break;
            case 'open-maykawa-modal':
                modals.openMaykawaModal();
                DOMElements.productionActionsModal.classList.remove('active');
                break;
            case 'open-rizky-modal':
                modals.openRizkyModal();
                DOMElements.productionActionsModal.classList.remove('active');
                break;
            case 'open-rizky-add-order-modal':
                modals.openRizkyAddOrderModal();
                DOMElements.rizkyModal.classList.remove('active');
                break;
            case 'save-rizky-orders': modals.saveRizkyOrders(); break;
            case 'open-rizky-order-list':
                modals.openRizkyOrderListModal();
                break;
            case 'open-maykawa-add-order-modal':
                modals.openMaykawaAddOrderModal();
                DOMElements.maykawaModal.classList.remove('active');
                break;
            case 'save-maykawa-orders': modals.saveMaykawaOrders(); break;
            case 'open-maykawa-order-list':
                modals.openMaykawaOrderListModal();
                break;
            case 'open-minced-meat-modal':
                modals.openMincedMeatModal();
                DOMElements.productionActionsModal.classList.remove('active');
                break;
            case 'open-wings-modal':
                modals.openWingsModal();
                DOMElements.productionActionsModal.classList.remove('active');
                break;
            case 'open-wings-settings-modal': modals.openWingsSettingsModal(); break;
            case 'save-wings-settings': modals.saveWingsSettings(); break;
            case 'export-wings-pdf': modals.exportWingsToPdf(); break;
            case 'open-add-minced-meat-order-modal':
                modals.openAddMincedMeatOrderModal();
                DOMElements.mincedMeatModal.classList.remove('active');
                break;
            case 'save-minced-meat-order': modals.saveMincedMeatOrder(); break;
            case 'delete-minced-meat-order-item': modals.deleteMincedMeatOrderItem(actionTarget.dataset.orderId, actionTarget.dataset.itemId); break;
            case 'close-modal':
                const modal = actionTarget.closest('.modal');
                if (modal) modal.classList.remove('active');
                break;
            case 'open-surovina-source-modal': modals.openSurovinaSourceModal(); break;
            case 'open-add-suroviny-modal-from-stock': modals.openAddSurovinyModalFromStock(); break;
            case 'open-add-suroviny-modal-from-production': modals.openAddSurovinyModalFromProduction(); break;
            case 'save-added-suroviny': modals.saveAddedSuroviny(); break;

            // Notifications
            case 'open-notifications-modal': notifications.openNotificationsModal(); break;
            case 'clear-notifications': notifications.clearNotifications(); break;
            case 'save-notification-settings': notifications.saveNotificationSettings(); break;

            default: break;
        }
    }
}

function handleGlobalChange(e) {
    const target = e.target;
    if (target.classList.contains('kfc-produced-input')) {
        kfc.handleKfcProductionChange(target);
    } else if (target.matches('#calculator-item-surovina, #calculator-item-type')) {
        calculator.renderCustomerInputs();
    } else if (target.matches('.shortage-stock-input')) {
        mainPage.handleShortageStockChange(target);
    } else if (target.matches('.shortage-done-count-input')) {
        mainPage.handleShortageDoneCountChange(target);
    } else if (target.matches('.pre-production-done-input')) {
        mainPage.handlePreProductionDoneChange(target);
    } else if (target.id === 'import-file-input') {
        importOrders.handleFileSelect(e);
    } else if (target.matches('[data-action="toggle-item-stabilized"]')) {
        const { orderId, itemId } = target.dataset;
        const order = appState.orders.find(o => o.id === orderId);
        const item = order?.items.find(i => i.id === itemId);
        if (item) {
            item.isStabilized = target.checked;
            const customerId = order.customerId;
            const type = item.type;
            if (!appState.mincedMeatStabilizedDefaults[customerId]) {
                appState.mincedMeatStabilizedDefaults[customerId] = {};
            }
            appState.mincedMeatStabilizedDefaults[customerId][type] = target.checked;
            saveState();
            if (DOMElements.mincedMeatModal.classList.contains('active')) {
                modals.renderMincedMeatModalContent();
            }
        }
    } else if (target.classList.contains('marinade-done-input')) {
        mainPage.handleMarinadeDoneChange(target);
    }
}

function handleGlobalInput(e) {
     const target = e.target;
    if (target.classList.contains('spizy-config-input')) {
        spizy.handleSpizySettingsInput();
    } else if (target.closest('#kfc-staff-modal')) {
        kfc.calculateKfcStaffing();
    } else if (target.classList.contains('spizy-done-input')) {
        spizy.handleSpizyDoneChange(target);
    } else if (target.classList.contains('main-order-done-input')) {
        mainPage.handleMainOrderDoneChange(target);
    }
}
