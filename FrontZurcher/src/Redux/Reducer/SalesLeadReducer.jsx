import { createSlice } from '@reduxjs/toolkit';
import {
  createLead,
  fetchLeads,
  fetchLeadById,
  updateLead,
  archiveLead,
  deleteLead,
  convertToBudget,
  fetchDashboardStats,
  createLeadNote,
  fetchLeadNotes,
  updateLeadNote,
  deleteLeadNote,
  markLeadNoteAsRead,
  fetchLeadsWithAlerts,
  fetchUpcomingReminders,
  completeReminder
} from '../Actions/salesLeadActions';

const initialState = {
  leads: [],
  currentLead: null,
  notes: [],
  loading: false,
  error: null,
  stats: null,
  statsTotal: 0,
  dashboardStats: null,
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  leadsWithAlerts: [],
  upcomingReminders: []
};

const salesLeadSlice = createSlice({
  name: 'salesLeads',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentLead: (state) => {
      state.currentLead = null;
      state.notes = [];
    }
  },
  extraReducers: (builder) => {
    // ========== CREATE LEAD ==========
    builder
      .addCase(createLead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createLead.fulfilled, (state, action) => {
        state.loading = false;
        state.leads.unshift(action.payload.lead);
        state.total += 1;
      })
      .addCase(createLead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al crear lead';
      });

    // ========== FETCH LEADS ==========
    builder
      .addCase(fetchLeads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false;
        state.leads = action.payload.leads;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalPages = action.payload.totalPages;
        state.stats = action.payload.stats;
        state.statsTotal = action.payload.statsTotal ?? 0;
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al obtener leads';
      });

    // ========== FETCH LEAD BY ID ==========
    builder
      .addCase(fetchLeadById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeadById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentLead = action.payload.lead;
        state.notes = action.payload.lead.notes || [];
      })
      .addCase(fetchLeadById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al obtener lead';
      });

    // ========== UPDATE LEAD ==========
    builder
      .addCase(updateLead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateLead.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.leads.findIndex(lead => lead.id === action.payload.lead.id);
        if (index !== -1) {
          state.leads[index] = action.payload.lead;
        }
        if (state.currentLead && state.currentLead.id === action.payload.lead.id) {
          state.currentLead = action.payload.lead;
        }
      })
      .addCase(updateLead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al actualizar lead';
      });

    // ========== ARCHIVE LEAD ==========
    builder
      .addCase(archiveLead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(archiveLead.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.leads.findIndex(lead => lead.id === action.payload.lead.id);
        if (index !== -1) {
          state.leads[index].status = 'archived';
        }
      })
      .addCase(archiveLead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al archivar lead';
      });

    // ========== DELETE LEAD ==========
    builder
      .addCase(deleteLead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteLead.fulfilled, (state, action) => {
        state.loading = false;
        // Eliminar del array de leads
        state.leads = state.leads.filter(lead => lead.id !== action.payload.deletedId);
        state.total -= 1;
        // Si era el lead actual, limpiarlo
        if (state.currentLead && state.currentLead.id === action.payload.deletedId) {
          state.currentLead = null;
          state.notes = [];
        }
      })
      .addCase(deleteLead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al eliminar lead';
      });

    // ========== CONVERT TO BUDGET ==========
    builder
      .addCase(convertToBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(convertToBudget.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.leads.findIndex(lead => lead.id === action.payload.lead.id);
        if (index !== -1) {
          state.leads[index] = action.payload.lead;
        }
        if (state.currentLead && state.currentLead.id === action.payload.lead.id) {
          state.currentLead = action.payload.lead;
        }
      })
      .addCase(convertToBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al convertir lead';
      });

    // ========== DASHBOARD STATS ==========
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboardStats = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Error al obtener estadísticas';
      });

    // ========== LEAD NOTES ==========
    builder
      .addCase(createLeadNote.fulfilled, (state, action) => {
        state.notes.unshift(action.payload.note);
        if (state.currentLead) {
          state.currentLead.lastActivityDate = new Date().toISOString();
        }
      })
      .addCase(fetchLeadNotes.fulfilled, (state, action) => {
        state.notes = action.payload.notes;
      })
      .addCase(updateLeadNote.fulfilled, (state, action) => {
        const index = state.notes.findIndex(note => note.id === action.payload.note.id);
        if (index !== -1) {
          state.notes[index] = action.payload.note;
        }
      })
      .addCase(deleteLeadNote.fulfilled, (state, action) => {
        state.notes = state.notes.filter(note => note.id !== action.meta.arg);
      })
      .addCase(markLeadNoteAsRead.fulfilled, (state, action) => {
        const index = state.notes.findIndex(note => note.id === action.payload.note.id);
        if (index !== -1) {
          state.notes[index] = action.payload.note;
        }
      });

    // ========== ALERTS & REMINDERS ==========
    builder
      .addCase(fetchLeadsWithAlerts.fulfilled, (state, action) => {
        state.leadsWithAlerts = action.payload.leads;
      })
      .addCase(fetchUpcomingReminders.fulfilled, (state, action) => {
        state.upcomingReminders = action.payload.reminders;
      })
      .addCase(completeReminder.fulfilled, (state, action) => {
        const index = state.notes.findIndex(note => note.id === action.payload.note.id);
        if (index !== -1) {
          state.notes[index] = action.payload.note;
        }
      });
  }
});

export const { clearError, clearCurrentLead } = salesLeadSlice.actions;
export default salesLeadSlice.reducer;
