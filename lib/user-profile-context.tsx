"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  UserBiometricProfile,
  DEFAULT_USER_PROFILE,
  DEFAULT_BIRTH_DATE,
  BmiCategoryInfo,
  calculateBmi,
  calculateAge,
  getBmiCategory,
  getIdealWeightRange,
  calculateFfmi,
} from "./biometrics";

export type { UserBiometricProfile, BmiCategoryInfo };
export {
  DEFAULT_USER_PROFILE,
  DEFAULT_BIRTH_DATE,
  calculateBmi,
  calculateAge,
  getBmiCategory,
  getIdealWeightRange,
  calculateFfmi,
};

interface UserProfileContextType {
  profile: UserBiometricProfile;
  updateProfile: (newValues: Partial<UserBiometricProfile>) => void;
  resetProfile: () => void;
  isHydrated: boolean;
  calculateAge: (fechaNacimiento?: string | null, referenceDate?: Date) => number;
  calculateBmi: (pesoKg: number) => number;
  getBmiCategory: (bmi: number) => BmiCategoryInfo;
  getIdealWeightRange: () => { min: number; max: number };
  calculateFfmi: (masaMagraKg: number) => { ffmi: number; ffmiNormalized: number; category: string };
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

const STORAGE_KEY = "bytehevy_user_biometric_profile";

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserBiometricProfile>(DEFAULT_USER_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const birthDate =
          typeof parsed.fechaNacimiento === "string" && parsed.fechaNacimiento.trim()
            ? parsed.fechaNacimiento.trim()
            : DEFAULT_BIRTH_DATE;
        const computedAge = calculateAge(birthDate);

        setProfile({
          alturaCm: typeof parsed.alturaCm === "number" ? parsed.alturaCm : DEFAULT_USER_PROFILE.alturaCm,
          fechaNacimiento: birthDate,
          edad: computedAge,
          sexo: parsed.sexo === "female" ? "female" : "male",
        });
      }
    } catch (e) {
      // ignore
    }
    setIsHydrated(true);
  }, []);

  const updateProfile = useCallback((newValues: Partial<UserBiometricProfile>) => {
    setProfile((prev) => {
      const updatedBirthDate =
        typeof newValues.fechaNacimiento === "string" && newValues.fechaNacimiento.trim()
          ? newValues.fechaNacimiento.trim()
          : prev.fechaNacimiento || DEFAULT_BIRTH_DATE;
      const updatedAge = calculateAge(updatedBirthDate);

      const updated: UserBiometricProfile = {
        ...prev,
        ...newValues,
        alturaCm: newValues.alturaCm !== undefined ? Number(newValues.alturaCm) : prev.alturaCm,
        fechaNacimiento: updatedBirthDate,
        edad: updatedAge,
        sexo: newValues.sexo || prev.sexo,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });
  }, []);

  const resetProfile = useCallback(() => {
    setProfile(DEFAULT_USER_PROFILE);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USER_PROFILE));
    } catch (e) {
      // ignore
    }
  }, []);

  const calcBmi = useCallback(
    (pesoKg: number) => calculateBmi(pesoKg, profile.alturaCm),
    [profile.alturaCm]
  );

  const getWeightRange = useCallback(
    () => getIdealWeightRange(profile.alturaCm),
    [profile.alturaCm]
  );

  const calcFfmi = useCallback(
    (masaMagraKg: number) => calculateFfmi(masaMagraKg, profile.alturaCm),
    [profile.alturaCm]
  );

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        updateProfile,
        resetProfile,
        isHydrated,
        calculateAge,
        calculateBmi: calcBmi,
        getBmiCategory,
        getIdealWeightRange: getWeightRange,
        calculateFfmi: calcFfmi,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextType {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
