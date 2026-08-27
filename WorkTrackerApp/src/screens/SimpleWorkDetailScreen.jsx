import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Image, Alert, ActivityIndicator, Platform, Linking,
  KeyboardAvoidingView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { Video } from 'expo-av';
import { useDispatch, useSelector } from "react-redux";
import { updateSimpleWorkStatus, uploadSimpleWorkImage } from "../Redux/Actions/simpleWorkActions";
import moment from "moment-timezone";

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
  culvert: "Culvert",
  drainfield: "Drainfield",
  repair: "Reparación",
  abandonment: "Abandono",
  modification: "Modificación",
  pumping: "Desagote",
  replacement: "Reemplazo",
  plumbing: "Plomería",
  inspection: "Inspección",
  installation: "Instalación",
  maintenance: "Mantenimiento",
  other: "Otro",
  // Legacy
  concrete_work: "Concreto",
  excavation: "Excavación",
  electrical: "Eléctrico",
  landscaping: "Paisajismo",
};

const STATUS_COLORS = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
  quoted: { bg: "bg-gray-200", text: "text-gray-700" },
  sent: { bg: "bg-blue-200", text: "text-blue-700" },
  approved: { bg: "bg-green-200", text: "text-green-700" },
  in_progress: { bg: "bg-amber-200", text: "text-amber-700" },
  completed: { bg: "bg-emerald-300", text: "text-emerald-800" },
  invoiced: { bg: "bg-purple-200", text: "text-purple-700" },
  paid: { bg: "bg-green-300", text: "text-green-800" },
  cancelled: { bg: "bg-red-200", text: "text-red-700" },
};

const TYPE_COLORS = {
  culvert:      { bg: "bg-blue-100",   text: "text-blue-700" },
  drainfield:   { bg: "bg-teal-100",   text: "text-teal-700" },
  repair:       { bg: "bg-orange-100", text: "text-orange-700" },
  abandonment:  { bg: "bg-gray-200",   text: "text-gray-700" },
  modification: { bg: "bg-indigo-100", text: "text-indigo-700" },
  pumping:      { bg: "bg-cyan-100",   text: "text-cyan-700" },
  replacement:  { bg: "bg-amber-100",  text: "text-amber-700" },
  plumbing:     { bg: "bg-blue-100",   text: "text-blue-700" },
  inspection:   { bg: "bg-yellow-100", text: "text-yellow-700" },
  installation: { bg: "bg-lime-100",   text: "text-lime-700" },
  maintenance:  { bg: "bg-purple-100", text: "text-purple-700" },
  other:        { bg: "bg-gray-100",   text: "text-gray-700" },
  // Legacy
  concrete_work: { bg: "bg-stone-200", text: "text-stone-700" },
  excavation:    { bg: "bg-orange-100",text: "text-orange-700" },
  electrical:    { bg: "bg-yellow-100",text: "text-yellow-700" },
  landscaping:   { bg: "bg-green-100", text: "text-green-700" },
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

const SimpleWorkDetailScreen = ({ route, navigation }) => {
  const paramWork = route.params?.simpleWork;
  const dispatch = useDispatch();

  // Subscribe to Redux store so the screen reflects status changes in real-time
  const liveWork = useSelector((state) =>
    state.simpleWork?.simpleWorks?.find((sw) => sw.id === paramWork?.id)
  );
  // Prefer live Redux data; fall back to route param (covers the initial load)
  const simpleWork = liveWork || paramWork;

  // All hooks must be called unconditionally (before any conditional return)
  const [resolution, setResolution] = useState(simpleWork?.resolution || "");
  const [localImages, setLocalImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");

  if (!simpleWork) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={{ color: '#dc2626', marginTop: 8, fontSize: 16 }}>Trabajo no encontrado</Text>
      </View>
    );
  }

  const existingCompletionImages = simpleWork.completionImages || [];
  const existingWorkImages = simpleWork.workImages || [];
  // Map invoiced/paid → show as "approved" to employee (payment is admin detail)
  const displayStatus = ['paid', 'invoiced'].includes(simpleWork.status) ? 'approved' : simpleWork.status;
  const statusStyle = STATUS_COLORS[displayStatus] || STATUS_COLORS.quoted;
  const typeStyle = TYPE_COLORS[simpleWork.workType] || TYPE_COLORS.other;

  // -------- Image Picking --------
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso necesario", "Se necesita acceso a la cámara para tomar fotos/videos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.3,
      allowsEditing: false,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLocalImages((prev) => [...prev, result.assets[0]]);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso necesario", "Se necesita acceso a la galería.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.3,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setLocalImages((prev) => [...prev, ...result.assets]);
    }
  };

  const removeLocalImage = (index) => {
    setLocalImages((prev) => prev.filter((_, i) => i !== index));
  };

  // -------- Upload all local images — throws on any failure --------
  const uploadImages = async () => {
    if (localImages.length === 0) return;
    setUploading(true);
    try {
      for (const img of localImages) {
        await dispatch(uploadSimpleWorkImage(simpleWork.id, img, 'completion'));
      }
      setLocalImages([]);
    } finally {
      setUploading(false);
    }
  };

  // -------- Submit as "Completado" --------
  const handleMarkCompleted = async () => {
    if (!resolution.trim() && localImages.length === 0) {
      setValidationError("Agregue un comentario o foto antes de marcar como completado.");
      return;
    }
    setValidationError("");
    setSaving(true);
    let photoWarning = false;
    try {
      if (localImages.length > 0) {
        try {
          await uploadImages();
        } catch {
          photoWarning = true;
        }
      }

      await dispatch(
        updateSimpleWorkStatus(simpleWork.id, {
          status: "completed",
          resolution: resolution.trim(),
          completedDate: new Date().toISOString(),
        })
      );

      navigation.goBack();
    } catch (err) {
      const errorMsg = err.response?.status === 401
        ? "Sesión expirada. Por favor cierre sesión e inicie sesión nuevamente."
        : err?.message || "No se pudo actualizar el trabajo. Intente nuevamente.";
      setValidationError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // -------- Submit as "En Progreso" (report) --------
  const handleReportProgress = async () => {
    if (!resolution.trim() && localImages.length === 0) {
      setValidationError("Agregue un comentario o foto antes de enviar el reporte.");
      return;
    }
    setValidationError("");
    setSaving(true);
    try {
      await uploadImages();
      await dispatch(
        updateSimpleWorkStatus(simpleWork.id, {
          status: "in_progress",
          notes: `${simpleWork.notes || ''}\n[${moment().format("MM-DD-YYYY HH:mm")}] ${resolution.trim()}`.trim(),
        })
      );
      navigation.goBack();
    } catch (err) {
      const errorMsg = err.response?.status === 401
        ? "Sesión expirada. Por favor cierre sesión e inicie sesión nuevamente."
        : err?.message || "No se pudo enviar el reporte. Intente nuevamente.";
      setValidationError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // -------- Upload only (no status change) --------
  const handleUploadOnly = async () => {
    setSaving(true);
    try {
      await uploadImages();
      setValidationError("");
    } catch (err) {
      setValidationError(err?.message || "No se pudieron subir las fotos.");
    } finally {
      setSaving(false);
    }
  };

  // clientData puede ser objeto o string JSON; puede venir del QuoteRequest o form manual
  let cd = {};
  try {
    const raw = simpleWork.clientData;
    cd = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? raw : {});
  } catch {}
  const clientName = cd.clientName || `${cd.firstName || ''} ${cd.lastName || ''}`.trim() || 'Cliente';
  const clientPhone = cd.clientPhone || cd.phone || null;

  const canAct = !['completed', 'cancelled'].includes(simpleWork.status);
  const isInProgress = simpleWork.status === 'in_progress';

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView className="flex-1 bg-gray-100" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ---- Work Info Card ---- */}
        <View className="bg-white mx-3 mt-4 p-4 rounded-xl shadow-sm">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-blue-900">{simpleWork.workNumber}</Text>
            <View className={`px-3 py-1 rounded-full ${typeStyle.bg}`}>
              <Text className={`text-xs font-bold ${typeStyle.text}`}>
                {WORK_TYPE_LABELS[simpleWork.workType] || simpleWork.workType}
              </Text>
            </View>
          </View>

          {/* Address - tappable */}
          <TouchableOpacity
            onPress={() => openInMaps(simpleWork.propertyAddress)}
            className="flex-row items-center mb-3 bg-blue-50 p-3 rounded-lg"
          >
            <Ionicons name="navigate" size={22} color="#2563eb" style={{ marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-base font-bold text-blue-700 uppercase">
                {simpleWork.propertyAddress || "Dirección no disponible"}
              </Text>
              <Text className="text-xs text-blue-500 mt-1">Tocar para abrir en Maps</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#2563eb" />
          </TouchableOpacity>

          {/* Client */}
          <View className="flex-row items-center mb-2">
            <Ionicons name="person-outline" size={16} color="#6b7280" style={{ marginRight: 6 }} />
            <Text className="text-sm font-medium text-gray-700">{clientName}</Text>
          </View>
          {clientPhone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${clientPhone}`)}
              className="flex-row items-center mb-3 bg-green-50 px-3 py-2 rounded-lg"
            >
              <Ionicons name="call-outline" size={16} color="#16a34a" style={{ marginRight: 6 }} />
              <Text className="text-sm font-semibold text-green-700">{clientPhone}</Text>
              <Text className="text-xs text-green-500 ml-2">Llamar</Text>
            </TouchableOpacity>
          ) : null}

          {/* Status */}
          <View className="flex-row items-center mb-3">
            <View className={`px-3 py-1 rounded-md ${statusStyle.bg}`}>
              <Text className={`text-xs font-bold uppercase ${statusStyle.text}`}>
                {STATUS_LABELS[displayStatus] || displayStatus}
              </Text>
            </View>
          </View>

          {/* Description */}
          {simpleWork.description ? (
            <View className="mb-3">
              <Text className="text-sm font-semibold text-gray-700 mb-1">Descripción:</Text>
              <Text className="text-sm text-gray-600">{simpleWork.description}</Text>
            </View>
          ) : null}

          {/* Dates */}
          <View className="space-y-1">
            {simpleWork.assignedDate && (
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={14} color="#6b7280" style={{ marginRight: 6 }} />
                <Text className="text-xs text-gray-600">
                  Asignado: {moment(simpleWork.assignedDate).format("MM-DD-YYYY")}
                </Text>
              </View>
            )}
            {simpleWork.startDate && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="play-circle-outline" size={14} color="#2563eb" style={{ marginRight: 6 }} />
                <Text className="text-xs text-blue-600">
                  Inicio: {moment(simpleWork.startDate).format("MM-DD-YYYY")}
                </Text>
              </View>
            )}
            {simpleWork.completedDate && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="checkmark-circle-outline" size={14} color="#059669" style={{ marginRight: 6 }} />
                <Text className="text-xs text-emerald-600">
                  Completado: {moment(simpleWork.completedDate).format("MM-DD-YYYY")}
                </Text>
              </View>
            )}
          </View>

          {/* Existing notes */}
          {simpleWork.notes ? (
            <View className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Text className="text-xs font-bold text-yellow-800 mb-1">Notas previas:</Text>
              <Text className="text-sm text-yellow-900">{simpleWork.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* ---- Existing Work Images ---- */}
        {existingWorkImages.length > 0 && (
          <View className="bg-white mx-3 mt-4 p-4 rounded-xl shadow-sm">
            <Text className="text-sm font-bold text-gray-700 mb-2">
              Fotos del trabajo ({existingWorkImages.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {existingWorkImages.map((img, idx) => (
                <Image
                  key={img.id || idx}
                  source={{ uri: img.url }}
                  className="w-24 h-24 rounded-lg mr-2"
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---- Existing Completion Images ---- */}
        {existingCompletionImages.length > 0 && (
          <View className="bg-white mx-3 mt-4 p-4 rounded-xl shadow-sm">
            <Text className="text-sm font-bold text-emerald-700 mb-2">
              Fotos de finalización ({existingCompletionImages.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {existingCompletionImages.map((img, idx) => (
                <Image
                  key={img.id || idx}
                  source={{ uri: img.url }}
                  className="w-24 h-24 rounded-lg mr-2"
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---- Image Upload Section ---- */}
        <View className="bg-white mx-3 mt-4 p-4 rounded-xl shadow-sm">
          <Text className="text-sm font-bold text-gray-700 mb-3">
            Agregar fotos/videos del trabajo
          </Text>

          <View className="flex-row mb-3">
            <TouchableOpacity
              onPress={pickFromCamera}
              className="flex-1 flex-row items-center justify-center bg-blue-600 py-3 rounded-lg mr-2"
            >
              <Ionicons name="camera" size={20} color="white" style={{ marginRight: 6 }} />
              <Text className="text-white font-semibold">Cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickFromGallery}
              className="flex-1 flex-row items-center justify-center bg-indigo-600 py-3 rounded-lg ml-2"
            >
              <Ionicons name="images" size={20} color="white" style={{ marginRight: 6 }} />
              <Text className="text-white font-semibold">Galería</Text>
            </TouchableOpacity>
          </View>

          {/* Local media preview */}
          {localImages.length > 0 && (
            <View>
              <Text className="text-xs text-gray-500 mb-2">
                {localImages.length} archivo{localImages.length !== 1 ? "s" : ""} seleccionado{localImages.length !== 1 ? "s" : ""}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {localImages.map((item, idx) => {
                  const isVideo = item.type === 'video' || item.uri?.match(/\.(mp4|mov|avi|mkv|webm)$/i);
                  return (
                    <View key={idx} className="mr-2 relative">
                      {isVideo ? (
                        <View className="relative">
                          <Video
                            source={{ uri: item.uri }}
                            className="w-24 h-24 rounded-lg bg-black"
                            resizeMode="cover"
                            shouldPlay={false}
                            isLooping={false}
                            useNativeControls={false}
                          />
                          <View className="absolute inset-0 items-center justify-center">
                            <Ionicons name="play-circle" size={32} color="white" style={{ opacity: 0.8 }} />
                          </View>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: item.uri }}
                          className="w-24 h-24 rounded-lg"
                          resizeMode="cover"
                        />
                      )}
                      <TouchableOpacity
                        onPress={() => removeLocalImage(idx)}
                        className="absolute -top-2 -right-2 bg-red-600 rounded-full w-6 h-6 items-center justify-center"
                      >
                        <Ionicons name="close" size={14} color="white" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ---- Comment / Resolution Input ---- */}
        <View className="bg-white mx-3 mt-4 p-4 rounded-xl shadow-sm">
          <Text className="text-sm font-bold text-gray-700 mb-2">
            Comentario del trabajo
          </Text>
          <TextInput
            placeholder="Describa el trabajo realizado o el estado actual..."
            value={resolution}
            onChangeText={(t) => { setResolution(t); if (validationError) setValidationError(""); }}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="border border-gray-300 rounded-lg p-3 text-base min-h-[100px] bg-gray-50"
          />
        </View>

        {/* ---- Action Buttons ---- */}
        <View className="mx-3 mt-4">
          {validationError ? (
            <View className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 mb-3 flex-row items-center">
              <Ionicons name="alert-circle" size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text className="text-red-700 text-sm flex-1">{validationError}</Text>
            </View>
          ) : null}
          {(uploading || saving) ? (
            <View className="items-center py-4">
              <ActivityIndicator size="large" color="#1e3a8a" />
              <Text className="text-sm text-blue-700 mt-2">
                {uploading ? "Subiendo archivos..." : "Guardando..."}
              </Text>
            </View>
          ) : (
            <>
              {canAct ? (
                <>
                  <TouchableOpacity
                    onPress={handleMarkCompleted}
                    className="bg-green-600 py-4 rounded-xl mb-3 flex-row items-center justify-center"
                  >
                    <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white text-lg font-bold">Marcar como Completado</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleReportProgress}
                    className="bg-amber-500 py-4 rounded-xl mb-3 flex-row items-center justify-center"
                  >
                    <Ionicons name="construct" size={24} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white text-lg font-bold">
                      {isInProgress ? "Enviar reporte de avance" : "Iniciar trabajo"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View className="items-center py-3 bg-gray-100 rounded-xl mb-3">
                  <Ionicons name="checkmark-done-circle" size={32} color="#6b7280" />
                  <Text className="text-gray-500 text-sm mt-2">
                    {simpleWork.status === 'completed' ? 'Trabajo completado' : 'Trabajo cancelado'}
                  </Text>
                </View>
              )}

              {/* Always allow uploading photos even after completion */}
              {localImages.length > 0 && (
                <TouchableOpacity
                  onPress={handleUploadOnly}
                  className="bg-blue-600 py-4 rounded-xl mb-3 flex-row items-center justify-center"
                >
                  <Ionicons name="cloud-upload" size={24} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white text-lg font-bold">
                    Subir {localImages.length} foto{localImages.length !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SimpleWorkDetailScreen;
