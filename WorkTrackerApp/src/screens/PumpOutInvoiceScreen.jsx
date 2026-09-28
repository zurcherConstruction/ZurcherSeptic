import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment-timezone';
import api from '../utils/axios';

// 🚗 Métodos de pago — DEBEN coincidir exactamente con los nombres usados en la
// sección administrativa (Expense/Income.paymentMethod) para que no haya que
// traducirlos/mapearlos luego al confirmar el pago desde la web.
const PAYMENT_METHODS = ['Efectivo', 'Zelle', 'Chase Bank', 'Cheque'];

const TODAY = moment().format('YYYY-MM-DD');

const PumpOutInvoiceScreen = () => {
  const navigation = useNavigation();
  const [form, setForm] = useState({
    clientName: '',
    clientAddress: '',
    tankGallons: '',
    price: '',
    paymentMethod: '',
    issueDate: TODAY,
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm({
      clientName: '',
      clientAddress: '',
      tankGallons: '',
      price: '',
      paymentMethod: '',
      issueDate: TODAY,
    });
  };

  const handleSubmit = async () => {
    if (!form.clientName.trim()) {
      Alert.alert('Error', 'El nombre del cliente es requerido.');
      return;
    }
    if (!form.clientAddress.trim()) {
      Alert.alert('Error', 'La dirección es requerida.');
      return;
    }
    if (!form.tankGallons || parseInt(form.tankGallons) <= 0) {
      Alert.alert('Error', 'Ingresá los galones del tanque.');
      return;
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      Alert.alert('Error', 'Ingresá el precio cobrado.');
      return;
    }
    if (!form.paymentMethod) {
      Alert.alert('Error', 'Seleccioná el método de pago.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/custom-invoices/pump-out', {
        clientName: form.clientName.trim(),
        clientAddress: form.clientAddress.trim(),
        tankGallons: parseInt(form.tankGallons),
        price: parseFloat(form.price),
        paymentMethod: form.paymentMethod,
        issueDate: form.issueDate,
      });

      const createdInvoice = data?.data;
      const isCash = form.paymentMethod === 'Efectivo';
      resetForm();
      Alert.alert(
        isCash ? '✅ Invoice pagado en efectivo' : '✅ Invoice generado',
        isCash
          ? `Se generó y marcó como pagado el invoice ${createdInvoice?.invoiceNumber || ''}. Recordá que ese efectivo no ingresa a la caja de la empresa.`
          : `Se generó el invoice ${createdInvoice?.invoiceNumber || ''}. Administración va a confirmar el pago (${form.paymentMethod}) más adelante.`,
        [
          { text: 'Ver mis invoices', onPress: () => navigation.navigate('MyPumpOutInvoices') },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo generar el invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDayPress = (day) => {
    update('issueDate', day.dateString);
    setShowCalendar(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Ionicons name="water-outline" size={28} color="#0f766e" />
            <Text style={styles.headerTitle}>Invoice de Desagote</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Completá los datos del cliente y el desagote realizado. Administración va a confirmar el pago.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos del Cliente</Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre completo del cliente"
              value={form.clientName}
              onChangeText={v => update('clientName', v)}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Dirección *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Dirección donde se realizó el desagote"
              multiline
              numberOfLines={2}
              value={form.clientAddress}
              onChangeText={v => update('clientAddress', v)}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos del Desagote</Text>

            <Text style={styles.label}>Galones del Tanque *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 1000"
              keyboardType="number-pad"
              value={form.tankGallons}
              onChangeText={v => update('tankGallons', v.replace(/[^0-9]/g, ''))}
            />

            <Text style={styles.label}>Precio Cobrado (USD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 250.00"
              keyboardType="decimal-pad"
              value={form.price}
              onChangeText={v => update('price', v.replace(/[^0-9.]/g, ''))}
            />

            <Text style={styles.label}>Fecha *</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowCalendar(!showCalendar)}>
              <Ionicons name="calendar-outline" size={18} color="#0f766e" />
              <Text style={styles.dateInputText}>
                {moment(form.issueDate, 'YYYY-MM-DD').format('MM-DD-YYYY')}
              </Text>
            </TouchableOpacity>
            {showCalendar && (
              <Calendar
                current={form.issueDate}
                onDayPress={onDayPress}
                markedDates={{ [form.issueDate]: { selected: true, selectedColor: '#0f766e' } }}
                maxDate={TODAY}
                style={styles.calendar}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Método de Pago *</Text>
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map(method => (
                <TouchableOpacity
                  key={method}
                  style={[styles.chip, form.paymentMethod === method && styles.chipSelected]}
                  onPress={() => update('paymentMethod', method)}
                >
                  <Text style={[styles.chipText, form.paymentMethod === method && styles.chipTextSelected]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Generar Invoice</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: Platform.OS === 'ios' ? 32 : 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f766e', flexShrink: 1 },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 18,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  textArea: { minHeight: 60 },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: '#f8fafc',
  },
  dateInputText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  calendar: { marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default PumpOutInvoiceScreen;
