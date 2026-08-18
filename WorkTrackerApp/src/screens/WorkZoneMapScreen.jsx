import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWorks } from '../Redux/Actions/workActions';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UploadScreen from './UploadScreen';

const Stack = createNativeStackNavigator();

// Definir las zonas y sus variantes de nombres
const ZONES = {
  'La Belle': {
    name: 'La Belle',
    color: '#f97316',
    keywords: ['la belle', 'labelle', 'la bell', 'labell', 'la. belle', 'l belle', ' belle ']
  },
  'Lehigh': {
    name: 'Lehigh Acres',
    color: '#a855f7',
    keywords: ['lehigh', 'lehigh acres', 'lehigh acre', 'leigh', 'leheigh', 'leihgh', 'l acres']
  },
  'North Port': {
    name: 'North Port / Port Charlotte',
    color: '#22c55e',
    keywords: [
      'north port', 'northport', 'n port', 'n. port', 'nport',
      'port charlotte', 'pt charlotte', 'portcharlotte', 'charlotte'
    ]
  },
  'Cape Coral': {
    name: 'Cape Coral',
    color: '#3b82f6',
    keywords: ['cape coral', 'cape', 'cc', 'c coral', 'capecoral', 'cap coral', 'coral']
  },
  'Other': {
    name: 'Otras Zonas',
    color: '#6b7280',
    keywords: []
  }
};

// Estados de campo que debe controlar
const FIELD_WORK_STATUSES = [
  'pending', 'assigned', 'inProgress', 'installed',
  'firstInspectionPending', 'rejectedInspection', 'coverPending'
];

const STATUS_LABELS = {
  'pending': 'COMENZAR',
  'assigned': 'COMENZAR',
  'inProgress': 'INSTALANDO',
  'installed': 'INSPECCIÓN',
  'firstInspectionPending': 'INSPECCIÓN',
  'rejectedInspection': 'INSPECCIÓN',
  'coverPending': 'CUBRIR'
};

const STATUS_COLORS = {
  'pending': '#9ca3af',
  'assigned': '#eab308',
  'inProgress': '#3b82f6',
  'installed': '#a855f7',
  'firstInspectionPending': '#a855f7',
  'rejectedInspection': '#ef4444',
  'coverPending': '#f97316'
};

// Orden de prioridad para sorting (menor número = más urgente/menos progreso)
const STATUS_ORDER = {
  'pending': 0,
  'assigned': 0,                // Mismo nivel que pending (ambos en COMENZAR)
  'inProgress': 1,              // INSTALANDO
  'installed': 2,               // INSPECCIÓN
  'firstInspectionPending': 2,  // INSPECCIÓN
  'rejectedInspection': 2,      // INSPECCIÓN (rechazada)
  'coverPending': 3             // CUBRIR
};

const WorkZoneMapListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { works, loading } = useSelector((state) => state.work);
  const { staff } = useSelector((state) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedZone, setSelectedZone] = useState('all');

  const isCapataz = staff?.role === 'capataz';

  useEffect(() => {
    if (isCapataz) {
      dispatch(fetchWorks()); // sin filtro → trae todos los trabajos
    } else {
      const staffId = staff?.idStaff || staff?.id;
      if (staffId) dispatch(fetchWorks(staffId));
    }
  }, [dispatch, staff, isCapataz]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isCapataz) {
      await dispatch(fetchWorks());
    } else {
      const staffId = staff?.idStaff || staff?.id;
      if (staffId) await dispatch(fetchWorks(staffId));
    }
    setRefreshing(false);
  };

  // Función para detectar zona
  const detectZone = (address) => {
    if (!address) return 'Other';
    const lowerAddress = address.toLowerCase();
    
    for (const [zoneName, zoneData] of Object.entries(ZONES)) {
      if (zoneName === 'Other') continue;
      
      const matches = zoneData.keywords.some(keyword => {
        if (keyword.startsWith(' ') && keyword.endsWith(' ')) {
          return lowerAddress.includes(keyword);
        }
        return lowerAddress.includes(keyword);
      });
      
      if (matches) return zoneName;
    }
    
    return 'Other';
  };

  // Agrupar trabajos por zona
  const worksByZone = useMemo(() => {
    const activeWorks = (works || []).filter(work => 
      FIELD_WORK_STATUSES.includes(work.status) && !work.isLegacy
    );

    const grouped = {};
    Object.keys(ZONES).forEach(zone => {
      grouped[zone] = [];
    });

    activeWorks.forEach(work => {
      const zone = detectZone(work.propertyAddress);
      grouped[zone].push(work);
    });

    // ✅ Ordenar obras dentro de cada zona por progreso (menos progreso primero)
    // COMENZAR → INSTALANDO → INSPECCIÓN → CUBRIR
    Object.keys(grouped).forEach(zone => {
      grouped[zone].sort((a, b) => {
        const orderA = STATUS_ORDER[a.status] ?? 999;
        const orderB = STATUS_ORDER[b.status] ?? 999;
        return orderA - orderB;
      });
    });

    return grouped;
  }, [works]);

  // Filtrar por zona seleccionada y mantener el orden
  const displayedWorks = useMemo(() => {
    if (selectedZone === 'all') {
      // Combinar todas las zonas manteniendo el orden interno de cada zona
      return Object.values(worksByZone).flat();
    }
    return worksByZone[selectedZone] || [];
  }, [selectedZone, worksByZone]);

  // Contar trabajos por zona
  const zoneCounts = useMemo(() => {
    const counts = {};
    Object.keys(ZONES).forEach(zone => {
      counts[zone] = worksByZone[zone]?.length || 0;
    });
    return counts;
  }, [worksByZone]);

  const handleWorkPress = (work) => {
    // Navegar a UploadScreen con los datos del trabajo
    navigation.navigate('UploadScreen', {
      idWork: work.idWork,
      propertyAddress: work.propertyAddress,
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando mapa de zonas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Mapa de Zonas</Text>
        <Text style={styles.headerSubtitle}>
          {displayedWorks.length} trabajo{displayedWorks.length !== 1 ? 's' : ''} activo{displayedWorks.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filtros de Zona */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.zoneFilters}
        contentContainerStyle={styles.zoneFiltersContent}
      >
        <TouchableOpacity
          style={[
            styles.zoneButton,
            selectedZone === 'all' && styles.zoneButtonActive
          ]}
          onPress={() => setSelectedZone('all')}
        >
          <Text style={[
            styles.zoneButtonText,
            selectedZone === 'all' && styles.zoneButtonTextActive
          ]}>
            Todas ({Object.values(zoneCounts).reduce((a, b) => a + b, 0)})
          </Text>
        </TouchableOpacity>

        {Object.entries(ZONES).map(([key, zone]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.zoneButton,
              selectedZone === key && styles.zoneButtonActive,
              selectedZone === key && { borderColor: zone.color }
            ]}
            onPress={() => setSelectedZone(key)}
          >
            <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
            <Text style={[
              styles.zoneButtonText,
              selectedZone === key && styles.zoneButtonTextActive
            ]}>
              {zone.name} ({zoneCounts[key]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista de Trabajos */}
      <ScrollView
        style={styles.worksList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {displayedWorks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="map-marker-off" size={64} color="#9ca3af" />
            <Text style={styles.emptyText}>
              No hay trabajos activos en esta zona
            </Text>
          </View>
        ) : (
          displayedWorks.map((work) => {
            const zone = detectZone(work.propertyAddress);
            const zoneColor = ZONES[zone]?.color || ZONES.Other.color;
            const statusLabel = STATUS_LABELS[work.status] || work.status;
            const statusColor = STATUS_COLORS[work.status] || '#6b7280';

            return (
              <TouchableOpacity
                key={work.idWork}
                style={styles.workCard}
                onPress={() => handleWorkPress(work)}
              >
                {/* Indicador de zona lateral */}
                <View style={[styles.zoneIndicator, { backgroundColor: zoneColor }]} />

                <View style={styles.workCardContent}>
                  {/* Header */}
                  <View style={styles.workCardHeader}>
                    <MaterialCommunityIcons 
                      name="map-marker" 
                      size={20} 
                      color={zoneColor} 
                    />
                    <Text style={styles.workZoneName}>{ZONES[zone]?.name}</Text>
                  </View>

                  {/* Dirección */}
                  <Text style={styles.workAddress} numberOfLines={2}>
                    {work.propertyAddress || 'Sin dirección'}
                  </Text>

                  {/* Status Badge */}
                  <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusLabel}</Text>
                  </View>

                  {/* Worker asignado */}
                  {work.Staff && (
                    <View style={styles.workerInfo}>
                      <MaterialCommunityIcons name="account-hard-hat" size={16} color="#6b7280" />
                      <Text style={styles.workerName}>
                        {work.Staff.firstName} {work.Staff.lastName}
                      </Text>
                    </View>
                  )}
                </View>

                <MaterialCommunityIcons name="chevron-right" size={24} color="#9ca3af" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  zoneFilters: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 60,
  },
  zoneFiltersContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  zoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  zoneButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  zoneButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  zoneButtonTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  worksList: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  workCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  zoneIndicator: {
    width: 4,
  },
  workCardContent: {
    flex: 1,
    padding: 16,
  },
  workCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workZoneName: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  workAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  workerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  workerName: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6b7280',
  },
});

// Stack Navigator para WorkZoneMap
const WorkZoneMapScreen = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="WorkZoneMapList" 
        component={WorkZoneMapListScreen}
      />
      <Stack.Screen 
        name="UploadScreen" 
        component={UploadScreen}
        options={{
          headerShown: true,
          title: 'Subir Imágenes',
        }}
      />
    </Stack.Navigator>
  );
};

export default WorkZoneMapScreen;
