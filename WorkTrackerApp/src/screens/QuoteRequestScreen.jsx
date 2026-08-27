import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { createQuoteRequest, uploadQuotePhotos } from '../Redux/Actions/quoteRequestActions';
import { resetState } from '../Redux/features/quoteRequestSlice';

const WORK_TYPES = [
  { value: 'desagote',    label: 'Desagote' },
  { value: 'reparacion',  label: 'Reparación' },
  { value: 'instalacion', label: 'Instalación' },
  { value: 'plomeria',    label: 'Plomería' },
  { value: 'inspeccion',  label: 'Inspección' },
  { value: 'culvert',     label: 'Culvert' },
  { value: 'drainfield',  label: 'Drainfield' },
  { value: 'otro',        label: 'Otro' },
];

const URGENCIES = [
  { value: 'low',       label: 'Baja',        color: '#6b7280' },
  { value: 'normal',    label: 'Normal',      color: '#2563eb' },
  { value: 'high',      label: 'Alta',        color: '#d97706' },
  { value: 'emergency', label: 'Emergencia',  color: '#dc2626' },
];

const QuoteRequestScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { submitting } = useSelector((state) => state.quoteRequest);

  const [form, setForm] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientAddress: '',
    workType: '',
    description: '',
    urgency: 'normal',
  });
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...uris].slice(0, 10));
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      setPhotos(prev => [...prev, result.assets[0].uri].slice(0, 10));
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setForm({ clientName: '', clientPhone: '', clientEmail: '', clientAddress: '', workType: '', description: '', urgency: 'normal' });
    setPhotos([]);
  };

  const handleSubmit = async () => {
    if (!form.clientName.trim()) {
      Alert.alert('Error', 'El nombre del cliente es requerido.');
      return;
    }
    if (!form.workType) {
      Alert.alert('Error', 'Seleccioná el tipo de trabajo.');
      return;
    }

    try {
      const request = await dispatch(createQuoteRequest({
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim() || null,
        clientEmail: form.clientEmail.trim() || null,
        clientAddress: form.clientAddress.trim() || null,
        workType: form.workType,
        description: form.description.trim() || null,
        urgency: form.urgency,
      }));

      if (photos.length > 0) {
        setUploadingPhotos(true);
        try {
          await dispatch(uploadQuotePhotos(request.id, photos));
        } catch (photoErr) {
          if (__DEV__) console.warn('Photo upload failed:', photoErr);
        } finally {
          setUploadingPhotos(false);
        }
      }

      dispatch(resetState());
      resetForm();
      Alert.alert(
        'Solicitud enviada',
        'La solicitud fue enviada a administración. Se van a contactar para hacer el presupuesto.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo enviar la solicitud.');
    }
  };

  const isLoading = submitting || uploadingPhotos;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Ionicons name="clipboard-outline" size={28} color="#1e3a8a" />
        <Text style={styles.headerTitle}>Nueva Solicitud de Cotización</Text>
      </View>
      <Text style={styles.headerSubtitle}>
        Completá los datos del cliente y el problema. Administración va a generar el presupuesto.
      </Text>

      {/* Client section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos del Cliente</Text>

        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre completo del cliente"
          value={form.clientName}
          onChangeText={v => update('clientName', v)}
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          placeholder="(305) 000-0000"
          keyboardType="phone-pad"
          value={form.clientPhone}
          onChangeText={v => update('clientPhone', v)}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="correo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.clientEmail}
          onChangeText={v => update('clientEmail', v)}
        />

        <Text style={styles.label}>Dirección / Ubicación</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Dirección o descripción de la ubicación"
          multiline
          numberOfLines={2}
          value={form.clientAddress}
          onChangeText={v => update('clientAddress', v)}
        />
      </View>

      {/* Work section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo de Trabajo *</Text>
        <View style={styles.chipGrid}>
          {WORK_TYPES.map(wt => (
            <TouchableOpacity
              key={wt.value}
              style={[styles.chip, form.workType === wt.value && styles.chipSelected]}
              onPress={() => update('workType', wt.value)}
            >
              <Text style={[styles.chipText, form.workType === wt.value && styles.chipTextSelected]}>
                {wt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Urgency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Urgencia</Text>
        <View style={styles.chipRow}>
          {URGENCIES.map(u => (
            <TouchableOpacity
              key={u.value}
              style={[
                styles.urgencyChip,
                form.urgency === u.value && { backgroundColor: u.color, borderColor: u.color },
              ]}
              onPress={() => update('urgency', u.value)}
            >
              <Text style={[styles.urgencyText, form.urgency === u.value && { color: '#fff' }]}>
                {u.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Descripción del Problema</Text>
        <TextInput
          style={[styles.input, styles.descriptionArea]}
          placeholder="Describí el problema o servicio que necesita el cliente..."
          multiline
          numberOfLines={4}
          value={form.description}
          onChangeText={v => update('description', v)}
        />
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fotos del Problema</Text>
        <Text style={styles.photoHint}>Podés agregar hasta 10 fotos para que administración tenga más contexto.</Text>

        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={20} color="#1e3a8a" />
            <Text style={styles.photoBtnText}>Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickImages}>
            <Ionicons name="images-outline" size={20} color="#1e3a8a" />
            <Text style={styles.photoBtnText}>Galería</Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoThumbContainer}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(i)}>
                  <Ionicons name="close-circle" size={20} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>Enviar a Administración</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e3a8a',
    flexShrink: 1,
  },
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
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
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  descriptionArea: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  chipSelected: {
    borderColor: '#1e3a8a',
    backgroundColor: '#1e3a8a',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#fff',
  },
  urgencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  photoHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1e3a8a',
    backgroundColor: '#eff6ff',
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1e3a8a',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default QuoteRequestScreen;
