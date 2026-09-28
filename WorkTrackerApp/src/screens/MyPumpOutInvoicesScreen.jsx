import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, SectionList, StyleSheet, ActivityIndicator,
  RefreshControl, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment-timezone';
import { useFocusEffect } from '@react-navigation/native';
import api from '../utils/axios';

const STATUS_LABELS = {
  draft: { label: 'Pendiente de confirmación', color: '#b45309', bg: '#fef3c7' },
  paid: { label: 'Pagado', color: '#15803d', bg: '#dcfce7' },
  void: { label: 'Anulado', color: '#b91c1c', bg: '#fee2e2' },
};

const MyPumpOutInvoicesScreen = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      const { data } = await api.get('/custom-invoices/pump-out/mine');
      setInvoices(data?.data || []);
    } catch (err) {
      console.error('❌ Error cargando mis invoices de desagote:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadInvoices();
    }, [loadInvoices])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
  };

  // Agrupar por mes (issueDate) — más reciente primero. Sin límite en el
  // backend, así que todos los invoices del contractor aparecen siempre.
  const sections = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      const monthKey = (inv.issueDate || '').slice(0, 7); // YYYY-MM
      if (!map[monthKey]) map[monthKey] = { monthKey, data: [], total: 0 };
      map[monthKey].data.push(inv);
      map[monthKey].total += parseFloat(inv.total || 0);
    });
    return Object.values(map)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .map(section => ({
        title: moment(section.monthKey, 'YYYY-MM').format('MMMM YYYY'),
        total: section.total,
        data: section.data,
      }));
  }, [invoices]);

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {section.title.charAt(0).toUpperCase() + section.title.slice(1)}
      </Text>
      <View style={styles.sectionHeaderRight}>
        <Text style={styles.sectionCount}>{section.data.length} invoice{section.data.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.sectionTotal}>${section.total.toFixed(2)}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.draft;
    const isCash = item.paymentMethod === 'Efectivo';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.clientName}>{item.clientName}</Text>
        <Text style={styles.clientAddress} numberOfLines={1}>{item.clientAddress}</Text>

        <View style={styles.rowInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="water-outline" size={14} color="#0f766e" />
            <Text style={styles.infoText}>{item.tankGallons} gal</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={14} color="#0f766e" />
            <Text style={styles.infoText}>{item.paymentMethod}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={14} color="#0f766e" />
            <Text style={styles.infoText}>{moment(item.issueDate, 'YYYY-MM-DD').format('MM-DD-YYYY')}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.total}>${parseFloat(item.total || 0).toFixed(2)}</Text>
          {isCash && (
            <Text style={styles.cashNote}>Cobrado en efectivo (no ingresa a caja)</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={invoices.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0f766e']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="water-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>Todavía no generaste ningún invoice de desagote.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  listContent: { padding: 12 },
  emptyContainer: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f766e' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCount: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  sectionTotal: { fontSize: 13, fontWeight: '800', color: '#0f766e' },
  invoiceNumber: { fontSize: 13, fontWeight: '700', color: '#0f766e', fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  clientAddress: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  rowInfo: { flexDirection: 'row', gap: 14, marginBottom: 8, flexWrap: 'wrap' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  total: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  cashNote: { fontSize: 11, color: '#b45309', fontStyle: 'italic', flexShrink: 1, textAlign: 'right' },
});

export default MyPumpOutInvoicesScreen;
