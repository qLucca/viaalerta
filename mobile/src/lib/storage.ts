import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { secureSession } from "./secure-session";
export const authStorage =
  Platform.OS === "web" ? AsyncStorage : secureSession(SecureStore);
