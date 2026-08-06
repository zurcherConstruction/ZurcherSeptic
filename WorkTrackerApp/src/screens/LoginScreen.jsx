import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../Redux/Actions/authActions";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BiometricService } from "../utils/biometricAuth";

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const dispatch = useDispatch();
  const { loading, error, isAuthenticated, staff, isLoading } = useSelector(
    (state) => state.auth
  );

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const availability = await BiometricService.isAvailable();
      setBiometricAvailable(availability.isSupported);

      if (availability.isSupported) {
        const credentials = await BiometricService.getCredentials();
        setBiometricEnabled(credentials?.enabled || false);

        // Si está habilitado, intentar login automático
        if (credentials?.enabled) {
          handleBiometricLogin();
        }
      }
    } catch (error) {
      console.error("Error checking biometric availability:", error);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const authResult = await BiometricService.authenticate();

      if (authResult.success) {
        const credentials = await BiometricService.getCredentials();
        if (credentials && credentials.email && credentials.password) {
          await dispatch(login(credentials.email, credentials.password));
        }
      }
    } catch (error) {
      console.error("Error en login biométrico:", error);
    }
  };

  const handleLogin = async () => {
    const result = await dispatch(login(email, password));

    // Si el login fue exitoso y la biometría está disponible, preguntar si quiere habilitarla
    if (result && !result.error && biometricAvailable && !biometricEnabled) {
      Alert.alert(
        "Autenticación Biométrica",
        "¿Deseas habilitar Face ID/Touch ID para futuros inicios de sesión?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Sí",
            onPress: async () => {
              await BiometricService.saveCredentials(email, password);
              setBiometricEnabled(true);
            },
          },
        ]
      );
    }
  };

  const handlePrivacyPolicyPress = () => {
    Linking.openURL("https://www.zurcherseptic.com/privacy-policy").catch(
      (err) => console.error("Error opening privacy policy URL:", err)
    );
  };

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log(`Login exitoso. Staff ID: ${staff?.id}, Rol: ${staff?.role}`);
      if (staff?.role === "owner") {
        navigation.replace("OwnerDrawer");
      } else if (staff?.role === "worker" || staff?.role === "maintenance" || staff?.role === "capataz") {
        navigation.replace("AppDrawer");
      } else {
        console.log("Rol desconocido, no se realiza redirección");
      }
    }
  }, [isAuthenticated, staff, navigation, isLoading]);

  // Si está cargando la verificación inicial, mostrar indicador
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Verificando sesión...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingContainer} // Usa un estilo con flex: 1
      behavior={Platform.OS === "ios" ? "padding" : "height"} // 'padding' para iOS
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} // Ajuste opcional del offset
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.formContainer}>
          <Text style={styles.title}>Iniciar Sesión</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.showPasswordButton}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color="#1e3a8a"
              />
            </TouchableOpacity>
          </View>
          <Pressable onPress={handleLogin} style={styles.button}>
            <Text style={styles.buttonText}>
              {loading ? "Cargando..." : "Iniciar Sesión"}
            </Text>
          </Pressable>
          {biometricAvailable && biometricEnabled && (
            <TouchableOpacity
              onPress={handleBiometricLogin}
              style={styles.biometricButton}
            >
              <Ionicons name="finger-print" size={24} color="#1e3a8a" />
              <Text style={styles.biometricText}>Usar Face ID / Touch ID</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.privacyContainer}>
          <Text style={styles.privacyText}>
            By continuing, you agree to our{" "}
            <Text style={styles.privacyLink} onPress={handlePrivacyPolicyPress}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1, // Necesario para que KeyboardAvoidingView funcione correctamente
  },
  scrollContainer: {
    flexGrow: 1, // Permite que el ScrollView crezca
    justifyContent: "center", // Centra el contenido verticalmente
    alignItems: "center", // Centra el contenido horizontalmente
    paddingVertical: 20, // Añade padding vertical si es necesario
    backgroundColor: "#f9f9f9", // Mueve el color de fondo aquí
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  formContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 20,
    textAlign: "center",
  },
  error: {
    color: "#dc2626",
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  passwordContainer: {
    position: "relative",
    width: "100%",
  },
  passwordInput: {
    paddingRight: 50,
  },
  showPasswordButton: {
    position: "absolute",
    right: 10,
    top: 12,
  },
  button: {
    width: "100%",
    backgroundColor: "#1e3a8a",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e3a8a",
    borderRadius: 8,
    backgroundColor: "#f8f9ff",
  },
  biometricText: {
    color: "#1e3a8a",
    fontSize: 16,
    marginLeft: 8,
    fontWeight: "500",
  },

    privacyContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  privacyLink: {
    color: '#1e3a8a',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
