import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import toastMiddleware from '../../utils/toastMiddleware';
import authReducer from '../Reducer/authReducer';
import pdfReducer from '../Reducer/pdfReducer';
import BudgetReducer from '../Reducer/BudgetReducer';
import adminReducer from '../Reducer/adminReducer';
import inspectionReducer from '../Reducer/inspectionReducer';
import materialReducer from '../Reducer/materialReducer';
import permitReducer from '../Reducer/permitReducer';
import workReducer from '../Reducer/workReducer';
import notificationReducer from '../Reducer/notificationReducer';
import receiptReducer from '../Reducer/receiptReducer';
import balanceReducer from '../Reducer/balanceReducer';
import uiReducer from '../Reducer/uiReducer';
import systemReducer from '../Reducer/SystemReducer';
import budgetItemReducer from '../Reducer/budgetItemReducer';
import finalInvoiceReducer from '../Reducer/finalInvoiceReducer';
import contactReducer from '../Reducer/contactReducer';
import maintenanceReducer from '../Reducer/maintenanceReducer';
import supplierInvoiceReducer from '../Reducer/supplierInvoiceReducer';
import budgetNoteReducer from '../Reducer/budgetNoteReducer';
import workNoteReducer from '../Reducer/workNoteReducer';
import checklistReducer from '../Reducer/checklistReducer'; // 🆕 Checklist reducer
import monthlyInstallationsReducer from '../Reducer/monthlyInstallationsReducer'; // 🆕 Monthly installations reducer
import staffAttendanceReducer from '../Reducer/staffAttendanceReducer'; // 🆕 Staff attendance reducer
import simpleWorkReducer from '../Reducer/simpleWorkReducer'; // 🆕 Simple work reducer
import claimReducer from '../Reducer/claimReducer'; // 🆕 Claims/Reclamos reducer
import reminderReducer from '../Reducer/reminderReducer'; // 🆕 Recordatorios reducer
import salesLeadReducer from '../Reducer/SalesLeadReducer'; // 🆕 Sales Leads reducer
import marketingCampaignsReducer from '../Reducer/marketingCampaignsReducer'; // 🆕 Marketing Campaigns reducer
import knowledgeBaseReducer from '../Reducer/knowledgeBaseReducer'; // 🆕 Knowledge Base reducer
import newsletterReducer from '../Reducers/newsletterReducer'; // 🆕 Newsletter reducer
import signatureDocumentReducer from '../Reducers/signatureDocumentReducer'; // 🆕 Signature Documents reducer

const rootReducer = combineReducers({
  auth: authReducer,
  pdf: pdfReducer,
  admin: adminReducer,
  budget: BudgetReducer,
  inspection: inspectionReducer,
  material: materialReducer,
  permit: permitReducer,
  work: workReducer,
  notifications: notificationReducer,
  receipts: receiptReducer,
  balance: balanceReducer,
  ui:uiReducer,
  systemType: systemReducer,
  budgetItems: budgetItemReducer,
  finalInvoice: finalInvoiceReducer,
  contact: contactReducer,
  maintenance: maintenanceReducer,
  supplierInvoice: supplierInvoiceReducer,
  budgetNote: budgetNoteReducer,
  workNote: workNoteReducer,
  checklist: checklistReducer, // 🆕 Checklist reducer
  monthlyInstallations: monthlyInstallationsReducer, // 🆕 Monthly installations reducer
  staffAttendance: staffAttendanceReducer, // 🆕 Staff attendance reducer
  simpleWork: simpleWorkReducer, // 🆕 Simple work reducer
  claim: claimReducer, // 🆕 Claims/Reclamos reducer
  reminders: reminderReducer, // 🆕 Recordatorios reducer
  salesLeads: salesLeadReducer, // 🆕 Sales Leads reducer
  marketingCampaigns: marketingCampaignsReducer, // 🆕 Marketing Campaigns reducer
  knowledgeBase: knowledgeBaseReducer, // 🆕 Knowledge Base reducer
  newsletter: newsletterReducer, // 🆕 Newsletter reducer
  signatureDocuments: signatureDocumentReducer, // 🆕 Signature Documents reducer
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(toastMiddleware),
});