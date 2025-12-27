import { create } from "zustand";

interface GuestUserFormState {
    email: string;
    password: string;
    setCredentials: (email: string, password: string) => void;
    clearCredentials: () => void;
}

export const useGuestUserFormStore = create<GuestUserFormState>((set) => ({
    email: "",
    password: "",
    setCredentials: (email, password) => set({ email, password }),
    clearCredentials: () => set({ email: "", password: "" }),
}));
