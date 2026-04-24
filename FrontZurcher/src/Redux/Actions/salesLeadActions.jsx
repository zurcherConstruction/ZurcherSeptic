import api from '../../utils/axios';
import { createAsyncThunk } from '@reduxjs/toolkit';

// 📝 Crear un nuevo lead
export const createLead = createAsyncThunk(
  'salesLeads/createLead',
  async (leadData, { rejectWithValue }) => {
    try {
      const response = await api.post('/sales-leads', leadData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al crear lead' });
    }
  }
);

// 📋 Obtener leads con filtros y paginación
export const fetchLeads = createAsyncThunk(
  'salesLeads/fetchLeads',
  async (params = {}, { rejectWithValue }) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        status = 'all',
        priority = 'all',
        search = '',
        tags = null,
        source = 'all',
        sortBy = 'lastActivityDate',
        sortOrder = 'DESC'
      } = params;

      const queryParams = new URLSearchParams();
      queryParams.append('page', page);
      queryParams.append('pageSize', pageSize);
      if (status !== 'all') queryParams.append('status', status);
      if (priority !== 'all') queryParams.append('priority', priority);
      if (search) queryParams.append('search', search);
      if (tags) queryParams.append('tags', tags);
      if (source !== 'all') queryParams.append('source', source);
      queryParams.append('sortBy', sortBy);
      queryParams.append('sortOrder', sortOrder);

      const response = await api.get(`/sales-leads?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener leads' });
    }
  }
);

// 🔍 Obtener un lead por ID
export const fetchLeadById = createAsyncThunk(
  'salesLeads/fetchLeadById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/sales-leads/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener lead' });
    }
  }
);

// ✏️ Actualizar un lead
export const updateLead = createAsyncThunk(
  'salesLeads/updateLead',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/sales-leads/${id}`, updates);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al actualizar lead' });
    }
  }
);

// 🗑️ Archivar un lead
export const archiveLead = createAsyncThunk(
  'salesLeads/archiveLead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/sales-leads/${id}/archive`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al archivar lead' });
    }
  }
);

// ❌ Eliminar permanentemente un lead (solo admin/owner)
export const deleteLead = createAsyncThunk(
  'salesLeads/deleteLead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/sales-leads/${id}`);
      return { ...response.data, deletedId: id };
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al eliminar lead' });
    }
  }
);

// 🔄 Convertir lead a presupuesto
export const convertToBudget = createAsyncThunk(
  'salesLeads/convertToBudget',
  async ({ id, budgetData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/sales-leads/${id}/convert-to-budget`, { budgetData });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al convertir lead' });
    }
  }
);

// 📊 Obtener estadísticas del dashboard
export const fetchDashboardStats = createAsyncThunk(
  'salesLeads/fetchDashboardStats',
  async ({ startDate, endDate } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/sales-leads/dashboard/stats?${params.toString()}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener estadísticas' });
    }
  }
);

// ========== LEAD NOTES ==========

// 📝 Crear nota para un lead
export const createLeadNote = createAsyncThunk(
  'salesLeads/createLeadNote',
  async (noteData, { rejectWithValue }) => {
    try {
      const response = await api.post('/lead-notes', noteData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al crear nota' });
    }
  }
);

// 📋 Obtener notas de un lead
export const fetchLeadNotes = createAsyncThunk(
  'salesLeads/fetchLeadNotes',
  async ({ leadId, filters = {} }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (filters.noteType && filters.noteType !== 'all') params.append('noteType', filters.noteType);
      if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.unresolved) params.append('unresolved', 'true');

      const response = await api.get(`/lead-notes/lead/${leadId}?${params.toString()}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener notas' });
    }
  }
);

// ✏️ Actualizar nota
export const updateLeadNote = createAsyncThunk(
  'salesLeads/updateLeadNote',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/lead-notes/${id}`, updates);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al actualizar nota' });
    }
  }
);

// 🗑️ Eliminar nota
export const deleteLeadNote = createAsyncThunk(
  'salesLeads/deleteLeadNote',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/lead-notes/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al eliminar nota' });
    }
  }
);

// ✅ Marcar nota como leída
export const markLeadNoteAsRead = createAsyncThunk(
  'salesLeads/markLeadNoteAsRead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/lead-notes/${id}/read`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al marcar nota' });
    }
  }
);

// 🔔 Obtener leads con alertas
export const fetchLeadsWithAlerts = createAsyncThunk(
  'salesLeads/fetchLeadsWithAlerts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/lead-notes/alerts/leads');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener alertas' });
    }
  }
);

// ⏰ Obtener recordatorios próximos
export const fetchUpcomingReminders = createAsyncThunk(
  'salesLeads/fetchUpcomingReminders',
  async (days = 7, { rejectWithValue }) => {
    try {
      const response = await api.get(`/lead-notes/reminders/upcoming?days=${days}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener recordatorios' });
    }
  }
);

// ✅ Completar recordatorio
export const completeReminder = createAsyncThunk(
  'salesLeads/completeReminder',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/lead-notes/${id}/reminder/complete`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al completar recordatorio' });
    }
  }
);

// ========== REPORTES Y ANÁLISIS ==========

// 📊 Obtener reporte semanal de actividad por staff
export const fetchWeeklyActivityReport = createAsyncThunk(
  'salesLeads/fetchWeeklyActivityReport',
  async ({ startDate, endDate, staffId } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (staffId) params.append('staffId', staffId);

      const response = await api.get(`/sales-leads/reports/weekly-activity?${params.toString()}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener reporte semanal' });
    }
  }
);

// 🔔 Obtener leads con múltiples intentos sin respuesta
export const fetchNoAnswerLeads = createAsyncThunk(
  'salesLeads/fetchNoAnswerLeads',
  async (minAttempts = 3, { rejectWithValue }) => {
    try {
      const response = await api.get(`/sales-leads/alerts/no-answer?minAttempts=${minAttempts}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Error al obtener leads sin respuesta' });
    }
  }
);
