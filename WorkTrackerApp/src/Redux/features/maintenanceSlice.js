import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/axios'; // Usando tu instancia de Axios configurada

// --- THUNKS ASÍNCRONOS ---

// 1. Obtener obras que están en estado 'maintenance' (con info de próxima visita)
export const fetchWorksInMaintenance = createAsyncThunk(
  'maintenance/fetchWorksInMaintenance',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/work/maintenance-overview`);
      // El backend debería devolver un array de obras.
      // Cada obra debería incluir 'nextMaintenanceDate' y 'nextVisitNumber' si aplica.
      return data;
    } catch (error) {
      console.error("Error en fetchWorksInMaintenance:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Error al obtener obras en mantenimiento');
    }
  }
);

// 2. Obtener todas las visitas de mantenimiento para una obra específica
export const fetchMaintenanceVisitsByWork = createAsyncThunk(
  'maintenance/fetchMaintenanceVisitsByWork',
  async (workId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/maintenance/work/${workId}`);
      return { workId, visits: data }; // data es un array de MaintenanceVisit
    } catch (error) {
      console.error("Error en fetchMaintenanceVisitsByWork:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Error al obtener visitas de mantenimiento');
    }
  }
);

// 3. Actualizar una visita de mantenimiento (fecha, notas, estado)
export const updateMaintenanceVisitData = createAsyncThunk(
  'maintenance/updateMaintenanceVisitData',
  async ({ visitId, visitData }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/maintenance/${visitId}`, visitData);
      return data.visit; // El backend devuelve la visita actualizada
    } catch (error) {
      console.error("Error en updateMaintenanceVisitData:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Error al actualizar visita de mantenimiento');
    }
  }
);

// 4. Añadir media (imágenes/videos) a una visita de mantenimiento
export const addMaintenanceMedia = createAsyncThunk(
  'maintenance/addMaintenanceMedia',
  async ({ visitId, formData }, { rejectWithValue }) => {
    // formData debe ser una instancia de FormData
    try {
      const { data } = await api.post(`/maintenance/${visitId}/media`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data.visit; // El backend devuelve la visita actualizada con la nueva media
    } catch (error) {
      console.error("Error en addMaintenanceMedia:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Error al añadir multimedia');
    }
  }
);

// 5. Eliminar un archivo multimedia de una visita de mantenimiento
export const deleteMaintenanceMediaFile = createAsyncThunk(
  'maintenance/deleteMaintenanceMediaFile',
  async ({ visitId, mediaId }, { rejectWithValue }) => {
    try {
      await api.delete(`/maintenance/media/${mediaId}`);
      return { visitId, mediaId }; // Devolver IDs para actualizar el estado
    } catch (error) {
      console.error("Error en deleteMaintenanceMediaFile:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Error al eliminar multimedia');
    }
  }
);

// 6. Obtener mantenimientos asignados al worker actual
// Acepta: workerId (string/number, comportamiento anterior) o un objeto
// { workerId, excludeCompleted, onlyCompleted } para pedir solo lo necesario
// y evitar que el límite del backend se llene con visitas ya completadas.
export const fetchAssignedMaintenances = createAsyncThunk(
  'maintenance/fetchAssignedMaintenances',
  async (args, { rejectWithValue }) => {
    const isObj = args && typeof args === 'object';
    const workerId = isObj ? args.workerId : args;
    const excludeCompleted = isObj ? args.excludeCompleted : undefined;
    const onlyCompleted = isObj ? args.onlyCompleted : undefined;
    try {
      const { data } = await api.get(`/maintenance/assigned`, {
        params: { workerId, excludeCompleted, onlyCompleted }
      });
      return data.visits || [];
    } catch (error) {
      console.error("[fetchAssignedMaintenances] Error:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Error al obtener mantenimientos asignados');
    }
  }
);

// 7. Generar token de corta duración para formulario web
export const generateMaintenanceToken = createAsyncThunk(
  'maintenance/generateMaintenanceToken',
  async (visitId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/maintenance/${visitId}/generate-token`);
      return data; // { token, visitId, expiresIn }
    } catch (error) {
      console.error("Error en generateMaintenanceToken:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.message || error.message || 'Error al generar token');
    }
  }
);

// --- SLICE DEFINITION ---

const initialState = {
  worksInMaintenance: [], // Lista de obras con status 'maintenance' y su próxima visita
  maintenanceVisitsByWorkId: {}, // { workId1: [visit1, visit2], workId2: [...] }
  assignedMaintenances: [], // Visitas asignadas al worker actual
  currentWorkDetail: null, // Para la obra seleccionada actualmente (puede incluir sus visitas)
  generatedToken: null, // Token generado para acceso al formulario
  loading: false, // Loading general para la lista de obras en mantenimiento
  loadingVisits: false, // Loading específico para visitas de una obra
  loadingAction: false, // Loading para acciones como update, addMedia, deleteMedia
  loadingAssigned: false, // Loading para obtener mantenimientos asignados
  error: null,
  visitsLoadedForWork: {}, 
};

const maintenanceSlice = createSlice({
  name: 'maintenance',
  initialState,
  reducers: {
    clearMaintenanceError: (state) => {
      state.error = null;
    },
    setCurrentWorkDetail: (state, action) => {
      const workData = action.payload;
      state.currentWorkDetail = {
        ...workData, // La obra base (de worksInMaintenance)
        maintenanceVisits: state.maintenanceVisitsByWorkId[workData.idWork] || [], // Visitas si ya están cargadas
      };
    },
    clearCurrentWorkDetail: (state) => {
      state.currentWorkDetail = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchWorksInMaintenance
      .addCase(fetchWorksInMaintenance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorksInMaintenance.fulfilled, (state, action) => {
        state.loading = false;
        state.worksInMaintenance = action.payload;
      })
      .addCase(fetchWorksInMaintenance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // fetchMaintenanceVisitsByWork
      .addCase(fetchMaintenanceVisitsByWork.pending, (state, action) => {
      state.loadingVisits = true;
      // Opcional: marcar como no cargado si se reintenta
      // if (action.meta.arg) {
      //   state.visitsLoadedForWork[action.meta.arg] = false;
      // }
    })
    .addCase(fetchMaintenanceVisitsByWork.fulfilled, (state, action) => {
      state.loadingVisits = false;
      const workId = action.meta.arg; // El workId pasado al thunk
      if (workId) {
        state.maintenanceVisitsByWorkId[workId] = action.payload;
        state.visitsLoadedForWork[workId] = true; // <--- MARCAR COMO CARGADO
      }
    })
    .addCase(fetchMaintenanceVisitsByWork.rejected, (state, action) => {
      state.loadingVisits = false;
      state.error = action.payload || action.error;
      // Opcional: marcar como no cargado en caso de error
      // if (action.meta.arg) {
      //  state.visitsLoadedForWork[action.meta.arg] = false;
      // }
    })

      // updateMaintenanceVisitData
      .addCase(updateMaintenanceVisitData.pending, (state) => {
        state.loadingAction = true;
        state.error = null;
      })
     .addCase(updateMaintenanceVisitData.fulfilled, (state, action) => {
        // ... tu lógica existente ...
        // Considera si una actualización debe invalidar el flag 'visitsLoadedForWork'
        // para forzar una recarga la próxima vez, o si actualizas los datos localmente.
        // Por ejemplo, si actualizas una visita, los datos en maintenanceVisitsByWorkId[workId]
        // se actualizan, por lo que visitsLoadedForWork[workId] puede permanecer true.
        const updatedVisit = action.payload.visit;
        if (updatedVisit && updatedVisit.workId) {
            const workId = updatedVisit.workId;
            if (state.maintenanceVisitsByWorkId[workId]) {
                const visitIndex = state.maintenanceVisitsByWorkId[workId].findIndex(v => v.id === updatedVisit.id);
                if (visitIndex !== -1) {
                    state.maintenanceVisitsByWorkId[workId][visitIndex] = updatedVisit;
                } else {
                     // Si la visita no existía, podrías añadirla o decidir recargar.
                     // Para simplificar, asumimos que actualiza una existente.
                }
            }
        }
    })

      .addCase(updateMaintenanceVisitData.rejected, (state, action) => {
        state.loadingAction = false;
        state.error = action.payload;
      })

      // addMaintenanceMedia
      .addCase(addMaintenanceMedia.pending, (state) => {
        state.loadingAction = true;
        state.error = null;
      })
      .addCase(addMaintenanceMedia.fulfilled, (state, action) => {
        state.loadingAction = false;
        const updatedVisitWithMedia = action.payload;
        const workId = updatedVisitWithMedia.workId;
        if (state.maintenanceVisitsByWorkId[workId]) {
          state.maintenanceVisitsByWorkId[workId] = state.maintenanceVisitsByWorkId[workId].map(
            (visit) => (visit.id === updatedVisitWithMedia.id ? updatedVisitWithMedia : visit)
          );
        }
        if (state.currentWorkDetail && state.currentWorkDetail.idWork === workId) {
          state.currentWorkDetail.maintenanceVisits = (state.currentWorkDetail.maintenanceVisits || []).map(
            (visit) => (visit.id === updatedVisitWithMedia.id ? updatedVisitWithMedia : visit)
          );
        }
      })
      .addCase(addMaintenanceMedia.rejected, (state, action) => {
        state.loadingAction = false;
        state.error = action.payload;
      })

      // deleteMaintenanceMediaFile
      .addCase(deleteMaintenanceMediaFile.pending, (state) => {
        state.loadingAction = true;
        state.error = null;
      })
      .addCase(deleteMaintenanceMediaFile.fulfilled, (state, action) => {
        state.loadingAction = false;
        const { visitId, mediaId } = action.payload;
        let workIdToUpdate = null;
        for (const workId in state.maintenanceVisitsByWorkId) {
          if (state.maintenanceVisitsByWorkId[workId].some(visit => visit.id === visitId)) {
            workIdToUpdate = workId;
            break;
          }
        }
        if (workIdToUpdate && state.maintenanceVisitsByWorkId[workIdToUpdate]) {
          const visitIndex = state.maintenanceVisitsByWorkId[workIdToUpdate].findIndex(v => v.id === visitId);
          if (visitIndex !== -1 && state.maintenanceVisitsByWorkId[workIdToUpdate][visitIndex].mediaFiles) {
            state.maintenanceVisitsByWorkId[workIdToUpdate][visitIndex].mediaFiles =
              state.maintenanceVisitsByWorkId[workIdToUpdate][visitIndex].mediaFiles.filter(mf => mf.id !== mediaId);
          }
        }
        if (state.currentWorkDetail && state.currentWorkDetail.maintenanceVisits) {
          const currentVisitIndex = state.currentWorkDetail.maintenanceVisits.findIndex(v => v.id === visitId);
          if (currentVisitIndex !== -1 && state.currentWorkDetail.maintenanceVisits[currentVisitIndex].mediaFiles) {
            state.currentWorkDetail.maintenanceVisits[currentVisitIndex].mediaFiles =
              state.currentWorkDetail.maintenanceVisits[currentVisitIndex].mediaFiles.filter(mf => mf.id !== mediaId);
          }
        }
      })
      .addCase(deleteMaintenanceMediaFile.rejected, (state, action) => {
        state.loadingAction = false;
        state.error = action.payload;
      })

      // fetchAssignedMaintenances
      .addCase(fetchAssignedMaintenances.pending, (state) => {
        state.loadingAssigned = true;
        state.error = null;
      })
      .addCase(fetchAssignedMaintenances.fulfilled, (state, action) => {
        state.loadingAssigned = false;
        state.assignedMaintenances = action.payload;
      })
      .addCase(fetchAssignedMaintenances.rejected, (state, action) => {
        state.loadingAssigned = false;
        state.error = action.payload;
      })

      // generateMaintenanceToken
      .addCase(generateMaintenanceToken.pending, (state) => {
        state.loadingAction = true;
        state.error = null;
      })
      .addCase(generateMaintenanceToken.fulfilled, (state, action) => {
        state.loadingAction = false;
        state.generatedToken = action.payload;
      })
      .addCase(generateMaintenanceToken.rejected, (state, action) => {
        state.loadingAction = false;
        state.error = action.payload;
      });
  },
});

export const { clearMaintenanceError, setCurrentWorkDetail, clearCurrentWorkDetail } = maintenanceSlice.actions;
export default maintenanceSlice.reducer;