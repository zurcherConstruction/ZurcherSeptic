import React, { useEffect, useState, useMemo } from "react";
import moment from "moment-timezone";
import { useSelector, useDispatch } from "react-redux";
import { fetchAssignedSimpleWorks } from "../Redux/Actions/simpleWorkActions";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Platform, Linking,
} from "react-native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation as useDrawerNavigation } from '@react-navigation/native';
import SimpleWorkDetailScreen from './SimpleWorkDetailScreen';

const Stack = createNativeStackNavigator();

const STATUS_LABELS = {
  pending: "Pendiente",
  quoted: "Cotizado",
  sent: "Enviado",
  approved: "Aprobado",
  in_progress: "En Progreso",
  completed: "Completado",
  invoiced: "Facturado",
  paid: "Pagado",
  cancelled: "Cancelado",
};

const WORK_TYPE_LABELS = {
  culvert:      "Culvert",
  drainfield:   "Drainfield",
  repair:       "Reparación",
  abandonment:  "Abandono",
  modification: "Modificación",
  pumping:      "Desagote",
  replacement:  "Reemplazo",
  plumbing:     "Plomería",
  inspection:   "Inspección",
  installation: "Instalación",
  maintenance:  "Mantenimiento",
  other:        "Otro",
  // Legacy
  concrete_work: "Concreto",
  excavation:    "Excavación",
  electrical:    "Eléctrico",
  landscaping:   "Paisajismo",
};

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  quoted: { bg: 'bg-gray-200', text: 'text-gray-700' },
  sent: { bg: 'bg-blue-200', text: 'text-blue-700' },
  approved: { bg: 'bg-green-200', text: 'text-green-700' },
  in_progress: { bg: 'bg-amber-200', text: 'text-amber-700' },
  completed: { bg: 'bg-emerald-300', text: 'text-emerald-800' },
  invoiced: { bg: 'bg-purple-200', text: 'text-purple-700' },
  paid: { bg: 'bg-green-300', text: 'text-green-800' },
  cancelled: { bg: 'bg-red-200', text: 'text-red-700' },
};

const PRIORITY_TYPE_COLORS = {
  culvert:      'bg-blue-100',
  drainfield:   'bg-teal-100',
  repair:       'bg-orange-100',
  abandonment:  'bg-gray-200',
  modification: 'bg-indigo-100',
  pumping:      'bg-cyan-100',
  replacement:  'bg-amber-100',
  plumbing:     'bg-blue-100',
  inspection:   'bg-yellow-100',
  installation: 'bg-lime-100',
  maintenance:  'bg-purple-100',
  other:        'bg-gray-100',
  // Legacy
  concrete_work: 'bg-stone-200',
  excavation:    'bg-orange-100',
  electrical:    'bg-yellow-100',
  landscaping:   'bg-green-100',
};

const openInMaps = (address) => {
  if (!address) return;
  const encoded = encodeURIComponent(address);
  const url = Platform.select({
    ios: `maps:0,0?q=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
  });
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  });
};

const SimpleWorksListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { simpleWorks, loading, error, lastUpdate } = useSelector((state) => state.simpleWork);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchAssignedSimpleWorks());
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchAssignedSimpleWorks());
    setRefreshing(false);
  };

  const filteredSimpleWorks = useMemo(() => {
    if (!simpleWorks) return [];

    // Show only active works — hide completed/paid/invoiced/cancelled
    let filtered = simpleWorks.filter(sw => !['completed', 'paid', 'invoiced', 'cancelled'].includes(sw.status));

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(sw =>
        sw.propertyAddress?.toLowerCase().includes(lowerQuery) ||
        sw.workNumber?.toLowerCase().includes(lowerQuery) ||
        sw.description?.toLowerCase().includes(lowerQuery)
      );
    }

    const statusOrder = { in_progress: 0, approved: 1, pending: 2, quoted: 3, sent: 4, invoiced: 5, completed: 6, paid: 7 };
    filtered.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 8;
      const orderB = statusOrder[b.status] ?? 8;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.assignedDate || b.createdAt || 0) - new Date(a.assignedDate || a.createdAt || 0);
    });

    return filtered;
  }, [simpleWorks, searchQuery]);

  if (loading && !refreshing && simpleWorks.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text className="text-lg text-blue-600 mt-4">Cargando trabajos varios...</Text>
      </View>
    );
  }

  if (error && simpleWorks.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100 p-5">
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text className="text-lg text-red-600 mt-2">{error}</Text>
        <TouchableOpacity
          onPress={() => dispatch(fetchAssignedSimpleWorks())}
          className="mt-4 bg-blue-600 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderHeader = () => (
    <View className="p-4 bg-white border-b border-gray-200">
      <View className="flex-row items-center mb-2">
        <Ionicons name="search" size={20} color="gray" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Buscar por dirección, número o descripción..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="flex-1 h-10 text-base"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          onPress={onRefresh}
          className="ml-2 p-2 bg-blue-100 rounded-lg"
        >
          <Ionicons name="refresh" size={20} color="#1e3a8a" />
        </TouchableOpacity>
      </View>
      {lastUpdate && (
        <Text className="text-xs text-gray-500 text-center">
          Última actualización: {new Date(lastUpdate).toLocaleTimeString()}
        </Text>
      )}
      <View className="flex-row justify-between mt-2">
        <Text className="text-sm text-gray-600">
          {filteredSimpleWorks.length} trabajo{filteredSimpleWorks.length !== 1 ? 's' : ''} asignado{filteredSimpleWorks.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );

  if (filteredSimpleWorks.length === 0 && !loading) {
    return (
      <View className="flex-1 bg-gray-100">
        {renderHeader()}
        <View className="flex-1 justify-center items-center p-5">
          <Ionicons name="construct-outline" size={64} color="#9ca3af" />
          <Text className="text-lg text-gray-600 text-center mt-4">
            {searchQuery
              ? `No se encontraron trabajos para "${searchQuery}".`
              : "No tienes trabajos varios asignados."}
          </Text>
        </View>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    // Map invoiced/paid → show as "approved" to employee (payment is admin detail)
    const displayStatus = ['paid', 'invoiced'].includes(item.status) ? 'approved' : item.status;
    const statusStyle = STATUS_COLORS[displayStatus] || STATUS_COLORS.quoted;
    const typeColor = PRIORITY_TYPE_COLORS[item.workType] || 'bg-gray-100';

    return (
      <TouchableOpacity
        onPress={() => {
          if (!item?.id) return;
          navigation.navigate('SimpleWorkDetail', { simpleWork: item });
        }}
        className={`mb-3 p-4 rounded-xl shadow-sm mx-3 mt-1 bg-white border-l-4 ${
          item.status === 'in_progress' ? 'border-l-amber-500' : 'border-l-blue-400'
        }`}
      >
        {/* Header: Work Number + Type Badge */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-bold text-blue-800">
            {item.workNumber}
          </Text>
          <View className={`px-2 py-0.5 rounded-full ${typeColor}`}>
            <Text className="text-xs font-medium text-gray-700">
              {WORK_TYPE_LABELS[item.workType] || item.workType}
            </Text>
          </View>
        </View>

        {/* Address - tappable to open Maps */}
        <TouchableOpacity
          onPress={() => openInMaps(item.propertyAddress)}
          className="flex-row items-center mb-2"
        >
          <Ionicons name="navigate-outline" size={16} color="#2563eb" style={{ marginRight: 4 }} />
          <Text className="text-base font-semibold text-blue-700 flex-1 uppercase underline" numberOfLines={2}>
            {item.propertyAddress || "Dirección no disponible"}
          </Text>
        </TouchableOpacity>

        {/* Description (truncated) */}
        {item.description && (
          <Text className="text-sm text-gray-600 mb-2" numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Status Badge */}
        <View className="flex-row items-center justify-between">
          <View className={`px-3 py-1 rounded-md ${statusStyle.bg}`}>
            <Text className={`text-xs font-bold uppercase ${statusStyle.text}`}>
              {STATUS_LABELS[displayStatus] || displayStatus}
            </Text>
          </View>

          <Text className="text-xs text-gray-500">
            {item.assignedDate
              ? moment.tz(item.assignedDate, "America/New_York").format("MM-DD-YYYY")
              : item.createdAt
              ? moment.tz(item.createdAt, "America/New_York").format("MM-DD-YYYY")
              : "Sin fecha"}
          </Text>
        </View>


      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      {renderHeader()}
      <FlatList
        data={filteredSimpleWorks}
        keyExtractor={(item) => item?.id?.toString() || String(Math.random())}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
        }
      />
    </View>
  );
};

// Stack Navigator wrapper
const AssignedSimpleWorksStackNavigator = () => {
  const drawerNavigation = useDrawerNavigation();
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="SimpleWorksList"
        component={SimpleWorksListScreen}
        options={{
          title: 'Mis Trabajos Varios',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => drawerNavigation.toggleDrawer()}
              style={{ marginRight: 12 }}
            >
              <Ionicons name="menu-outline" size={28} color="#1e3a8a" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="SimpleWorkDetail"
        component={SimpleWorkDetailScreen}
        options={({ route }) => ({
          title: route.params?.simpleWork?.workNumber || 'Detalle Trabajo',
        })}
      />
    </Stack.Navigator>
  );
};

export default AssignedSimpleWorksStackNavigator;
