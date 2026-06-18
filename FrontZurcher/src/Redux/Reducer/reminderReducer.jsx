import { createSlice } from '@reduxjs/toolkit';
import {
  REMINDER_REQUEST,
  REMINDER_FAILURE,
  FETCH_MY_REMINDERS_SUCCESS,
  FETCH_ALL_REMINDERS_SUCCESS,
  CREATE_REMINDER_SUCCESS,
  UPDATE_REMINDER_SUCCESS,
  DELETE_REMINDER_SUCCESS,
  TOGGLE_COMPLETE_SUCCESS,
  ADD_COMMENT_SUCCESS,
  DELETE_COMMENT_SUCCESS,
  UPDATE_COMMENT_SUCCESS,
} from '../Actions/reminderActions';

const initialState = {
  reminders: [],      // My reminders (with myAssignment)
  allReminders: [],   // All reminders (admin/owner view)
  loading: false,
  error: null,
};

const updateInArray = (arr, updated) =>
  arr.map(r => r.id === updated.id ? updated : r);

const reminderSlice = createSlice({
  name: 'reminder',
  initialState,
  reducers: {
    clearReminderError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (a) => a.type === REMINDER_REQUEST,
        (state) => { state.loading = true; state.error = null; }
      )
      .addMatcher(
        (a) => a.type === REMINDER_FAILURE,
        (state, action) => { state.loading = false; state.error = action.payload; }
      )
      .addMatcher(
        (a) => a.type === FETCH_MY_REMINDERS_SUCCESS,
        (state, action) => { state.loading = false; state.reminders = action.payload; }
      )
      .addMatcher(
        (a) => a.type === FETCH_ALL_REMINDERS_SUCCESS,
        (state, action) => { state.loading = false; state.allReminders = action.payload; }
      )
      .addMatcher(
        (a) => a.type === CREATE_REMINDER_SUCCESS,
        (state, action) => {
          state.loading = false;
          state.reminders = [action.payload, ...state.reminders];
          state.allReminders = [action.payload, ...state.allReminders];
        }
      )
      .addMatcher(
        (a) => a.type === UPDATE_REMINDER_SUCCESS,
        (state, action) => {
          state.loading = false;
          state.reminders = updateInArray(state.reminders, action.payload);
          state.allReminders = updateInArray(state.allReminders, action.payload);
        }
      )
      .addMatcher(
        (a) => a.type === DELETE_REMINDER_SUCCESS,
        (state, action) => {
          state.loading = false;
          state.reminders = state.reminders.filter(r => r.id !== action.payload);
          state.allReminders = state.allReminders.filter(r => r.id !== action.payload);
        }
      )
      .addMatcher(
        (a) => a.type === TOGGLE_COMPLETE_SUCCESS,
        (state, action) => {
          const { id, completed, completedAt, staffId } = action.payload;
          const upd = (arr) => arr.map(r => {
            if (r.id !== id) return r;
            const assignments = (r.assignments || []).map(a => {
              const assignmentStaffId = a.staff?.id || a.staffId || a.staff_id;
              if (assignmentStaffId !== staffId) return a;
              return { ...a, completed, completedAt };
            });
            return { ...r, assignments, myAssignment: { ...(r.myAssignment || {}), completed, completedAt } };
          });
          state.reminders = upd(state.reminders);
          state.allReminders = upd(state.allReminders);
        }
      )
      .addMatcher(
        (a) => a.type === ADD_COMMENT_SUCCESS,
        (state, action) => {
          const { reminderId, comment } = action.payload;
          const upd = (arr) => arr.map(r => {
            if (r.id !== reminderId) return r;
            return { ...r, comments: [...(r.comments || []), comment] };
          });
          state.reminders = upd(state.reminders);
          state.allReminders = upd(state.allReminders);
        }
      )
      .addMatcher(
        (a) => a.type === DELETE_COMMENT_SUCCESS,
        (state, action) => {
          const { reminderId, commentId } = action.payload;
          const upd = (arr) => arr.map(r => {
            if (r.id !== reminderId) return r;
            return { ...r, comments: (r.comments || []).filter(c => c.id !== commentId) };
          });
          state.reminders = upd(state.reminders);
          state.allReminders = upd(state.allReminders);
        }
      )
      .addMatcher(
        (a) => a.type === UPDATE_COMMENT_SUCCESS,
        (state, action) => {
          const { reminderId, comment } = action.payload;
          const upd = (arr) => arr.map(r => {
            if (r.id !== reminderId) return r;
            return {
              ...r,
              comments: (r.comments || []).map(c => c.id === comment.id ? comment : c),
            };
          });
          state.reminders = upd(state.reminders);
          state.allReminders = upd(state.allReminders);
        }
      );
  },
});

export const { clearReminderError } = reminderSlice.actions;
export default reminderSlice.reducer;
