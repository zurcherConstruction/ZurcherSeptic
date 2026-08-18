import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssignedMaintenances } from '../Redux/features/maintenanceSlice';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import MaintenanceFormScreen from './MaintenanceFormScreen';

const Stack = createNativeStackNavigator();

const CompletedMaintenanceListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  
  const { assignedMaintenances, loadingAssigned, error } = useSelector(state => state.maintenance);
  const { staff } = useSelector(state => state.auth);
  
  const [refreshing, setRefreshing] = useState(false);
  
  const staffId = staff?.id;
  const isCapataz = staff?.role === 'capataz';

  useEffect(() => {
    if (isCapataz || staffId) {
      loadMaintenances();
    }
  }, [staffId, isCapataz]);

  // 🔄 Auto-refresh al volver de editar mantenimiento
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
      await dispatch(fetchAssignedMaintenances(isCapataz ? undefined : staffId)).unwrap();
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
    navigation.navigate('MaintenanceFormScreen', { 
      visit: visit,
      isEditing: true
    });
  };

  const getStatusIcon = (status) => {
    return '✅';
  };

  const renderVisitCard = ({ item: visit }) => {
    const permitData = visit.work?.Permit;
    const completedDate = visit.actualVisitDate || visit.updatedAt;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleVisitPress(visit)}
        activeOpacity={0.7}
      >
        {/* Dirección de la propiedad */}
        <View style={styles.propertyHeader}>
          <Text style={styles.propertyIcon}>🏠</Text>
          <Text style={styles.propertyAddress}>
            {permitData?.propertyAddress || 'Dirección no disponible'}
          </Text>
        </View>

        {/* Banner verde de VISITA DE MANTENIMIENTO */}
        <View style={styles.maintenanceBanner}>
          <Text style={styles.bannerText}>VISITA DE MANTENIMIENTO</Text>
        </View>

        {/* Fecha Completada */}
        {completedDate && (
          <Text style={styles.dateText}>
            <Text style={styles.dateLabel}>Fecha Completada: </Text>
            {format(parseISO(completedDate), 'MM-dd-yyyy', { locale: es })}
          </Text>
        )}

        {/* Número de visita */}
        <Text style={styles.visitText}>
          <Text style={styles.visitLabel}>Visita #: </Text>
          {visit.visitNumber}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No hay mantenimientos completados</Text>
      <Text style={styles.emptyText}>
        Cuando completes una visita de mantenimiento, aparecerá aquí
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Text style={styles.refreshButtonText}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  );

  if (loadingAssigned && !refreshing && assignedMaintenances.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Cargando mantenimientos...</Text>
      </View>
    );
  }

  // Filtrar solo visitas completadas (capataz ve todas, workers ven las suyas)
  const completedVisits = assignedMaintenances.filter(v =>
    v.status === 'completed' && (isCapataz || v.completed_by_staff_id === staffId)
  );

  return (
    <View style={styles.container}>
    

      {/* Lista de visitas completadas */}
      <FlatList
        data={completedVisits}
        keyExtractor={(item) => item.id}
        renderItem={renderVisitCard}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
        }
        contentContainerStyle={[
          styles.listContent,
          completedVisits.length === 0 && styles.listContentEmpty
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  propertyIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  propertyAddress: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#1F2937',
    flex: 1,
  },
  maintenanceBanner: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 12,
    alignItems: 'center',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 14,
    color: '#2563EB',
    marginBottom: 8,
  },
  dateLabel: {
    fontWeight: '700',
    color: '#1F2937',
  },
  visitText: {
    fontSize: 14,
    color: '#6B7280',
  },
  visitLabel: {
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  visitNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  completedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  completedText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  propertySection: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyApplicant: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  systemTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  systemTypeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  systemTypeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  systemTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  ctaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
  },
  ctaArrow: {
    fontSize: 16,
    color: '#10B981',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
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
    backgroundColor: '#10B981',
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

// Stack Navigator para Mantenimientos Completados
const CompletedMaintenanceList = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="CompletedMaintenanceListScreen"
        component={CompletedMaintenanceListScreen}
        options={{ title: 'Mantenimientos Completados' }}
      />
      <Stack.Screen
        name="MaintenanceFormScreen"
        component={MaintenanceFormScreen}
        options={({ route }) => ({
          title: route.params?.visit?.work?.Permit?.propertyAddress || 'Ver Inspección',
        })}
      />
    </Stack.Navigator>
  );
};

export default CompletedMaintenanceList;
