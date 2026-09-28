import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Linking
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssignedMaintenances } from '../Redux/features/maintenanceSlice';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import MaintenanceFormScreen from './MaintenanceFormScreen';

const Stack = createNativeStackNavigator();

const MaintenanceListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  
  const { assignedMaintenances, loadingAssigned, error } = useSelector(state => state.maintenance);
  const { staff } = useSelector(state => state.auth);
  
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'overdue'
  const [selectedZone, setSelectedZone] = useState(null); // null = todas las zonas
  const [addressQuery, setAddressQuery] = useState('');

  const staffId = staff?.id;
  const isCapataz = staff?.role === 'capataz';

  useEffect(() => {
    if (isCapataz || staffId) {
      loadMaintenances();
    }
  }, [staffId, isCapataz]);

  useFocusEffect(
    useCallback(() => {
      if (isCapataz || staffId) {
        loadMaintenances();
      }
    }, [staffId, isCapataz])
  );

  const loadMaintenances = async () => {
    if (!isCapataz && !staffId) {
      Alert.alert('Error', 'No se pudo identificar el usuario');
      return;
    }
    try {
      await dispatch(fetchAssignedMaintenances({
        workerId: isCapataz ? undefined : staffId,
        excludeCompleted: true,
      })).unwrap();
    } catch (err) {
      Alert.alert('Error', err || 'Error al cargar mantenimientos');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMaintenances();
    setRefreshing(false);
  };

  const handleVisitPress = (visit) => {
    navigation.navigate('MaintenanceFormScreen', { visit });
  };

  const openInMaps = (address) => {
    if (!address) return;
    const url = Platform.OS === 'ios'
      ? `maps:0,0?q=${encodeURIComponent(address)}`
      : `geo:0,0?q=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    });
  };

  // ── Filtrar, agrupar por zona y ordenar por más vencido ──
  const { sections, zoneStats, totalPending, totalOverdue } = useMemo(() => {
    const pendingVisits = assignedMaintenances.filter(v =>
      v.status !== 'completed' && (isCapataz || v.staffId === staffId)
    );

    if (pendingVisits.length === 0) {
      return { sections: [], zoneStats: [], totalPending: 0, totalOverdue: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcular días, dirección y zona para cada visita
    const withDays = pendingVisits.map(v => {
      const scheduled = new Date(v.scheduledDate);
      scheduled.setHours(0, 0, 0, 0);
      const days = Math.floor((scheduled - today) / (1000 * 60 * 60 * 24));
      const permitData = v.work?.Permit;
      const address = permitData?.propertyAddress || v.fullAddress || '';
      const zone = v.extractedCity
        ? v.extractedCity.replace(/\b\w/g, c => c.toUpperCase())
        : 'Sin Zona';
      return { ...v, _days: days, _isOverdue: days < 0, _address: address, _zone: zone };
    });

    // Ordenar: más vencido primero (menor _days primero)
    withDays.sort((a, b) => a._days - b._days);

    // Filtro por dirección (aplica siempre, independiente de zona/vencidas)
    const addressFiltered = addressQuery.trim()
      ? withDays.filter(v => v._address.toLowerCase().includes(addressQuery.trim().toLowerCase()))
      : withDays;

    // Stats por zona (para los chips), calculadas sobre el filtro de dirección
    const zoneMap = {};
    addressFiltered.forEach(v => {
      if (!zoneMap[v._zone]) zoneMap[v._zone] = { count: 0, overdueCount: 0 };
      zoneMap[v._zone].count++;
      if (v._isOverdue) zoneMap[v._zone].overdueCount++;
    });
    const zoneStats = Object.entries(zoneMap)
      .map(([zone, data]) => ({ zone, ...data }))
      .sort((a, b) => b.overdueCount - a.overdueCount || b.count - a.count);

    // Aplicar filtro de "vencidas" y de zona seleccionada
    let filtered = addressFiltered;
    if (filterMode === 'overdue') filtered = filtered.filter(v => v._isOverdue);
    if (selectedZone) filtered = filtered.filter(v => v._zone === selectedZone);

    // Agrupar en secciones por zona
    const sectionMap = {};
    filtered.forEach(v => {
      if (!sectionMap[v._zone]) sectionMap[v._zone] = { visits: [], overdueCount: 0, totalDays: 0 };
      sectionMap[v._zone].visits.push(v);
      if (v._isOverdue) sectionMap[v._zone].overdueCount++;
      sectionMap[v._zone].totalDays += v._days;
    });

    // Convertir a secciones y ordenar zonas:
    // primero las que tienen más vencidos, luego por promedio de días
    const sectionList = Object.entries(sectionMap).map(([zone, data]) => ({
      title: zone,
      data: data.visits,
      overdueCount: data.overdueCount,
      count: data.visits.length,
      avgDays: data.totalDays / data.visits.length,
    }));

    sectionList.sort((a, b) => {
      // Zonas con vencidos primero
      if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
      // Luego por promedio de días (más urgente primero)
      return a.avgDays - b.avgDays;
    });

    return {
      sections: sectionList,
      zoneStats,
      totalPending: addressFiltered.length,
      totalOverdue: addressFiltered.filter(v => v._isOverdue).length,
    };
  }, [assignedMaintenances, staffId, isCapataz, filterMode, selectedZone, addressQuery]);

  const hasActiveFilters = filterMode !== 'all' || !!selectedZone || !!addressQuery.trim();

  const clearFilters = () => {
    setFilterMode('all');
    setSelectedZone(null);
    setAddressQuery('');
  };

  const renderSectionHeader = ({ section }) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      activeOpacity={0.7}
      onPress={() => setSelectedZone(prev => (prev === section.title ? null : section.title))}
    >
      <View style={styles.sectionHeaderLeft}>
        <Ionicons name="location" size={18} color="#1e3a8a" />
        <Text style={styles.sectionTitle} numberOfLines={1}>{section.title}</Text>
      </View>
      <View style={styles.sectionBadges}>
        {section.overdueCount > 0 && (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueBadgeText}>
              {section.overdueCount} vencida{section.overdueCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{section.count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderVisitCard = ({ item: visit }) => {
    const permitData = visit.work?.Permit;
    const address = permitData?.propertyAddress || visit.fullAddress || 'Dirección no disponible';
    const isOverdue = visit._isOverdue;
    const days = Math.abs(visit._days);

    let urgencyColor = '#10B981'; // verde - a tiempo
    let urgencyBg = '#ECFDF5';
    let urgencyText = `En ${days} día${days !== 1 ? 's' : ''}`;
    
    if (isOverdue) {
      urgencyColor = '#DC2626';
      urgencyBg = '#FEF2F2';
      urgencyText = `Vencida hace ${days} día${days !== 1 ? 's' : ''}`;
    } else if (visit._days === 0) {
      urgencyColor = '#EA580C';
      urgencyBg = '#FFF7ED';
      urgencyText = 'HOY';
    } else if (visit._days <= 3) {
      urgencyColor = '#F59E0B';
      urgencyBg = '#FFFBEB';
      urgencyText = `En ${days} día${days !== 1 ? 's' : ''}`;
    }

    return (
      <TouchableOpacity
        onPress={() => handleVisitPress(visit)}
        style={[styles.card, isOverdue && styles.cardOverdue]}
        activeOpacity={0.7}
      >
        {/* Urgencia */}
        <View style={[styles.urgencyBar, { backgroundColor: urgencyBg }]}>
          <Ionicons 
            name={isOverdue ? 'warning' : visit._days === 0 ? 'alarm' : 'time-outline'} 
            size={16} 
            color={urgencyColor} 
          />
          <Text style={[styles.urgencyText, { color: urgencyColor }]}>{urgencyText}</Text>
        </View>

        {/* Dirección de la propiedad - tappable para mapa */}
        <TouchableOpacity 
          onPress={() => openInMaps(address)}
          style={styles.addressRow}
          activeOpacity={0.7}
        >
          <Ionicons name="navigate-outline" size={16} color="#2563EB" />
          <Text style={styles.propertyAddress} numberOfLines={2}>{address}</Text>
        </TouchableOpacity>

        {/* Info row */}
        <View style={styles.infoRow}>
          {visit.scheduledDate && (
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.infoText}>
                {format(parseISO(visit.scheduledDate), 'MM-dd-yyyy', { locale: es })}
              </Text>
            </View>
          )}
          <View style={styles.infoItem}>
            <Ionicons name="repeat-outline" size={14} color="#6B7280" />
            <Text style={styles.infoText}>Visita #{visit.visitNumber}</Text>
          </View>
          {permitData?.systemType && (
            <View style={[styles.systemBadge]}>
              <Text style={styles.systemText}>{permitData.systemType}</Text>
            </View>
          )}
        </View>

        {/* Flecha */}
        <View style={styles.arrowRow}>
          <Text style={styles.ctaLabel}>Completar inspección</Text>
          <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-done-circle-outline" size={64} color="#10B981" />
      <Text style={styles.emptyTitle}>
        {hasActiveFilters ? 'Sin resultados para estos filtros' : 'No hay mantenimientos pendientes'}
      </Text>
      <Text style={styles.emptyText}>
        {hasActiveFilters
          ? 'Probá cambiar la zona, el estado o el texto de búsqueda'
          : 'Todas tus visitas asignadas han sido completadas'}
      </Text>
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={hasActiveFilters ? clearFilters : onRefresh}
      >
        <Text style={styles.refreshButtonText}>
          {hasActiveFilters ? 'Limpiar filtros' : 'Actualizar'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loadingAssigned && !refreshing && assignedMaintenances.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Cargando mantenimientos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bloque de filtros: resumen, búsqueda y zonas, unificado en un solo panel */}
      {assignedMaintenances.length > 0 && (
        <View style={styles.filtersWrapper}>
          <View style={styles.summaryBar}>
            <TouchableOpacity
              style={[styles.summaryCell, filterMode === 'all' && styles.summaryCellActive]}
              activeOpacity={0.7}
              onPress={() => setFilterMode('all')}
            >
              <Text style={styles.summaryNumber}>{totalPending}</Text>
              <Text style={styles.summaryLabel} numberOfLines={1}>Pendientes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.summaryCell,
                styles.summaryCellDanger,
                filterMode === 'overdue' && styles.summaryCellDangerActive,
              ]}
              activeOpacity={0.7}
              onPress={() => setFilterMode(prev => (prev === 'overdue' ? 'all' : 'overdue'))}
            >
              <Text style={[styles.summaryNumber, { color: '#DC2626' }]}>{totalOverdue}</Text>
              <Text style={[styles.summaryLabel, { color: '#DC2626' }]} numberOfLines={1}>Vencidas</Text>
            </TouchableOpacity>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryNumber}>{zoneStats.length}</Text>
              <Text style={styles.summaryLabel} numberOfLines={1}>Zonas</Text>
            </View>
          </View>

          {/* Filtro por dirección */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por dirección..."
              placeholderTextColor="#9CA3AF"
              value={addressQuery}
              onChangeText={setAddressQuery}
              autoCorrect={false}
            />
            {addressQuery.length > 0 && (
              <TouchableOpacity onPress={() => setAddressQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Chips de zona */}
          {zoneStats.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.zoneChipsScroll}
              contentContainerStyle={styles.zoneChipsContainer}
            >
              <TouchableOpacity
                style={[styles.zoneChip, !selectedZone && styles.zoneChipActive]}
                onPress={() => setSelectedZone(null)}
              >
                <Text style={[styles.zoneChipText, !selectedZone && styles.zoneChipTextActive]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {zoneStats.map(z => (
                <TouchableOpacity
                  key={z.zone}
                  style={[styles.zoneChip, selectedZone === z.zone && styles.zoneChipActive]}
                  onPress={() => setSelectedZone(prev => (prev === z.zone ? null : z.zone))}
                >
                  <Text
                    style={[styles.zoneChipText, selectedZone === z.zone && styles.zoneChipTextActive]}
                    numberOfLines={1}
                  >
                    {z.zone} ({z.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Botón limpiar filtros */}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={14} color="#3B82F6" />
              <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Lista agrupada por zona */}
      {sections.length === 0 ? (
        renderEmptyState()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderVisitCard}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summaryBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  summaryCellDanger: {
    backgroundColor: '#FEF2F2',
  },
  summaryCellActive: {
    backgroundColor: '#DBEAFE',
  },
  summaryCellDangerActive: {
    backgroundColor: '#FECACA',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    padding: 0,
  },
  zoneChipsScroll: {
    flexGrow: 0,
    height: 44,
    marginTop: 8,
  },
  zoneChipsContainer: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneChip: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    justifyContent: 'center',
    maxWidth: 160,
  },
  zoneChipActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  zoneChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  zoneChipTextActive: {
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginHorizontal: 12,
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  summaryNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e3a8a',
    textTransform: 'capitalize',
  },
  sectionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  overdueBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  overdueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  countBadge: {
    backgroundColor: '#DBEAFE',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    marginHorizontal: 12,
    marginTop: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  urgencyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  propertyAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    textDecorationLine: 'underline',
    textDecorationColor: '#93C5FD',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
  },
  systemBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  systemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  arrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ctaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

// Stack Navigator para Mantenimientos Pendientes
const MaintenanceList = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="MaintenanceListScreen"
        component={MaintenanceListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MaintenanceFormScreen"
        component={MaintenanceFormScreen}
        options={({ route }) => ({
          title: route.params?.visit?.work?.Permit?.propertyAddress || 'Completar Inspección',
        })}
      />
    </Stack.Navigator>
  );
};

export default MaintenanceList;
