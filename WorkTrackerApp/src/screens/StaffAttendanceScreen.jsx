import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment-timezone';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../utils/axios';
import { fetchStaff } from '../Redux/Actions/staffActions';

const ELIGIBLE_ROLES = ['worker', 'capataz', 'maintenance', 'contractor'];

const ROLE_LABELS = {
  worker: 'Worker',
  capataz: 'Capataz',
  maintenance: 'Maintenance',
  contractor: 'Contractor',
};

const ROLE_COLORS = {
  worker: { bg: 'bg-blue-100', text: 'text-blue-700' },
  capataz: { bg: 'bg-purple-100', text: 'text-purple-700' },
  maintenance: { bg: 'bg-orange-100', text: 'text-orange-700' },
  contractor: { bg: 'bg-teal-100', text: 'text-teal-700' },
  external: { bg: 'bg-gray-200', text: 'text-gray-700' },
};

const DATE_FORMAT = 'YYYY-MM-DD';

// Key used in attendanceMap for external workers
const extKey = (name) => `__ext__${name}`;

const StaffAttendanceScreen = () => {
  const dispatch = useDispatch();
  const { staff: staffList, loading: staffLoading } = useSelector((state) => state.staff);

  const today = moment().format(DATE_FORMAT);
  const [selectedDate, setSelectedDate] = useState(today);
  const [attendanceMap, setAttendanceMap] = useState({}); // key -> { id, isPresent }
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingIds, setSavingIds] = useState({});

  // External workers (not in the system)
  const [customWorkers, setCustomWorkers] = useState([]); // [{ name }]
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');

  const isToday = selectedDate === today;

  const eligibleStaff = useMemo(() => {
    return (staffList || [])
      .filter((s) => ELIGIBLE_ROLES.includes(s.role) && s.isActive !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [staffList]);

  const loadAttendance = useCallback(async (dateStr) => {
    setLoadingAttendance(true);
    try {
      const m = moment(dateStr, DATE_FORMAT);
      const res = await api.get('/staff-attendance/monthly', {
        params: { year: m.year(), month: m.month() + 1 },
      });
      const days = res.data?.data?.days || {};
      const dayRecords = days[dateStr] || [];
      const map = {};
      const loadedCustom = [];

      dayRecords.forEach((rec) => {
        if (rec.staff) {
          map[rec.staff.id] = { id: rec.id, isPresent: rec.isPresent };
        } else if (rec.customName) {
          map[extKey(rec.customName)] = { id: rec.id, isPresent: rec.isPresent };
          loadedCustom.push({ name: rec.customName });
        }
      });

      setAttendanceMap(map);
      // Merge loaded external workers with any already added locally
      setCustomWorkers((prev) => {
        const existingNames = new Set(prev.map((c) => c.name));
        const newOnes = loadedCustom.filter((c) => !existingNames.has(c.name));
        return [...prev, ...newOnes];
      });
    } catch (error) {
      console.error('Error cargando asistencia:', error);
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  useEffect(() => {
    dispatch(fetchStaff());
  }, [dispatch]);

  useEffect(() => {
    setCustomWorkers([]);
    loadAttendance(selectedDate);
  }, [selectedDate, loadAttendance]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([dispatch(fetchStaff()), loadAttendance(selectedDate)]);
    setRefreshing(false);
  };

  const handleMark = async (worker, isPresent) => {
    const key = worker.isCustom ? extKey(worker.name) : worker.id;
    setSavingIds((prev) => ({ ...prev, [key]: true }));
    try {
      const payload = worker.isCustom
        ? { customName: worker.name, workDate: selectedDate, isPresent }
        : { staffId: worker.id, workDate: selectedDate, isPresent };

      const res = await api.post('/staff-attendance/mark', payload);
      setAttendanceMap((prev) => ({
        ...prev,
        [key]: { id: res.data.data.id, isPresent },
      }));
    } catch (error) {
      console.error('Error marcando asistencia:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar la asistencia.');
    } finally {
      setSavingIds((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleAddCustomWorker = () => {
    const name = customNameInput.trim();
    if (!name) return;
    const already = customWorkers.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (already) {
      setCustomNameInput('');
      setShowAddCustom(false);
      return;
    }
    setCustomWorkers((prev) => [...prev, { name }]);
    setCustomNameInput('');
    setShowAddCustom(false);
  };

  const handleRemoveCustomWorker = (name) => {
    setCustomWorkers((prev) => prev.filter((c) => c.name !== name));
    setAttendanceMap((prev) => {
      const next = { ...prev };
      delete next[extKey(name)];
      return next;
    });
  };

  const goToPreviousDay = () => {
    setSelectedDate((prev) => moment(prev, DATE_FORMAT).subtract(1, 'day').format(DATE_FORMAT));
  };

  const goToNextDay = () => {
    if (isToday) return;
    setSelectedDate((prev) => moment(prev, DATE_FORMAT).add(1, 'day').format(DATE_FORMAT));
  };

  const presentCount = Object.values(attendanceMap).filter((a) => a.isPresent).length;

  // Combined list: system staff + external workers
  const allWorkers = useMemo(() => {
    const reals = eligibleStaff.map((s) => ({ ...s, isCustom: false }));
    const customs = customWorkers.map((c) => ({ id: extKey(c.name), name: c.name, role: 'external', isCustom: true }));
    return [...reals, ...customs];
  }, [eligibleStaff, customWorkers]);

  const renderHeader = () => (
    <View className="p-4 bg-white border-b border-gray-200">
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={goToPreviousDay} className="p-2 bg-gray-100 rounded-lg">
          <Ionicons name="chevron-back" size={22} color="#1e3a8a" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-base font-bold text-blue-900">
            {isToday ? 'Today' : moment(selectedDate, DATE_FORMAT).format('dddd')}
          </Text>
          <Text className="text-xs text-gray-500">
            {moment(selectedDate, DATE_FORMAT).format('MM-DD-YYYY')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={goToNextDay}
          disabled={isToday}
          className={`p-2 rounded-lg ${isToday ? 'bg-gray-50' : 'bg-gray-100'}`}
        >
          <Ionicons name="chevron-forward" size={22} color={isToday ? '#d1d5db' : '#1e3a8a'} />
        </TouchableOpacity>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-sm text-gray-600">
          {allWorkers.length} empleado{allWorkers.length !== 1 ? 's' : ''}
        </Text>
        <View className="bg-green-100 px-3 py-1 rounded-full">
          <Text className="text-xs font-bold text-green-700">{presentCount} presentes</Text>
        </View>
      </View>
    </View>
  );

  const renderAddCustom = () => (
    <View className="mx-3 mt-3 mb-1">
      {showAddCustom ? (
        <View className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            Nombre del trabajador externo
          </Text>
          <TextInput
            value={customNameInput}
            onChangeText={setCustomNameInput}
            placeholder="Ej: Juan Pérez"
            autoFocus
            className="border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-800 mb-3"
            onSubmitEditing={handleAddCustomWorker}
            returnKeyType="done"
          />
          <View className="flex-row">
            <TouchableOpacity
              onPress={handleAddCustomWorker}
              disabled={!customNameInput.trim()}
              className={`flex-1 mr-2 py-2 rounded-lg items-center ${customNameInput.trim() ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <Text className={`font-semibold text-sm ${customNameInput.trim() ? 'text-white' : 'text-gray-400'}`}>
                Agregar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowAddCustom(false); setCustomNameInput(''); }}
              className="flex-1 py-2 rounded-lg items-center bg-gray-100"
            >
              <Text className="font-semibold text-sm text-gray-600">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setShowAddCustom(true)}
          className="flex-row items-center justify-center py-2.5 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50"
        >
          <Ionicons name="person-add-outline" size={18} color="#2563eb" />
          <Text className="text-sm font-medium text-blue-600 ml-2">Agregar trabajador externo</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderItem = ({ item }) => {
    const key = item.isCustom ? extKey(item.name) : item.id;
    const record = attendanceMap[key];
    const isSaving = !!savingIds[key];
    const roleStyle = ROLE_COLORS[item.role] || ROLE_COLORS.external;
    const isPresentSelected = record?.isPresent === true;
    const isAbsentSelected = record?.isPresent === false;

    return (
      <View className="flex-row items-center bg-white mx-3 my-1.5 p-3 rounded-xl shadow-sm border border-gray-100">
        <View className="flex-1 mr-2">
          <View className="flex-row items-center">
            <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
            {item.isCustom && (
              <TouchableOpacity
                onPress={() => handleRemoveCustomWorker(item.name)}
                className="ml-2 p-1"
              >
                <Ionicons name="close-circle-outline" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          <View className={`self-start mt-1 px-2 py-0.5 rounded-full ${roleStyle.bg}`}>
            <Text className={`text-xs font-medium ${roleStyle.text}`}>
              {item.isCustom ? 'Externo' : (ROLE_LABELS[item.role] || item.role)}
            </Text>
          </View>
        </View>
        {isSaving ? (
          <ActivityIndicator size="small" color="#1e3a8a" style={{ width: 88 }} />
        ) : (
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => handleMark(item, true)}
              className={`w-11 h-11 rounded-full items-center justify-center mr-2 ${
                isPresentSelected ? 'bg-green-600' : 'bg-green-50'
              }`}
            >
              <Ionicons name="checkmark" size={22} color={isPresentSelected ? '#fff' : '#16a34a'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleMark(item, false)}
              className={`w-11 h-11 rounded-full items-center justify-center ${
                isAbsentSelected ? 'bg-red-600' : 'bg-red-50'
              }`}
            >
              <Ionicons name="close" size={22} color={isAbsentSelected ? '#fff' : '#dc2626'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const isInitialLoading =
    (staffLoading && eligibleStaff.length === 0) ||
    (loadingAttendance && !refreshing && Object.keys(attendanceMap).length === 0);

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {renderHeader()}
      {isInitialLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text className="text-base text-blue-600 mt-3">Cargando personal...</Text>
        </View>
      ) : (
        <FlatList
          data={allWorkers}
          keyExtractor={(item) => item.isCustom ? `ext-${item.name}` : item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
          ListHeaderComponent={renderAddCustom}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-6 mt-8">
              <Ionicons name="people-outline" size={48} color="#9ca3af" />
              <Text className="text-base text-gray-500 mt-3 text-center">
                No hay personal activo de campo registrado.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default StaffAttendanceScreen;
