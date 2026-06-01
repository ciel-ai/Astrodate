import { AlertVariant } from '@/constants/alert-theme';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type AuthAlertAction = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

export type AuthAlertConfig = {
    title: string;
    message: string;
    actions?: AuthAlertAction[];
    visible: boolean;
    variant?: AlertVariant | string;
};

type AuthAlertContextType = {
    alertConfig: AuthAlertConfig;
    showAlert: (title: string, message: string, actions?: AuthAlertAction[], variant?: AlertVariant | string) => void;
    hideAlert: () => void;
};

const AuthAlertContext = createContext<AuthAlertContextType | undefined>(undefined);

export function AuthAlertProvider({ children }: { children: React.ReactNode }) {
    const [alertConfig, setAlertConfig] = useState<AuthAlertConfig>({
        title: '',
        message: '',
        actions: undefined,
        visible: false,
    });

    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hideAlert = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        setAlertConfig((prev) => ({ ...prev, visible: false }));
    }, []);

    const showAlert = useCallback(
        (title: string, message: string, actions?: AuthAlertAction[], variant?: AlertVariant | string) => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }

            setAlertConfig({
                title,
                message,
                actions,
                visible: true,
                variant,
            });
        },
        []
    );

    return (
        <AuthAlertContext.Provider value={{ alertConfig, showAlert, hideAlert }}>
            {children}
        </AuthAlertContext.Provider>
    );
}

export function useAuthAlert() {
    const context = useContext(AuthAlertContext);
    if (!context) {
        throw new Error('useAuthAlert must be used within AuthAlertProvider');
    }
    return context;
}
