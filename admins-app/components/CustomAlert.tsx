import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  icon?: 'success' | 'error' | 'warning' | 'info' | 'question';
  onClose: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons,
  icon = 'info',
  onClose,
}) => {
  const getIcon = () => {
    switch (icon) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: '#C41E26' };
      case 'error':
        return { name: 'close-circle' as const, color: '#C41E26' };
      case 'warning':
        return { name: 'warning' as const, color: '#FF6B00' };
      case 'question':
        return { name: 'help-circle' as const, color: '#C41E26' };
      default:
        return { name: 'information-circle' as const, color: '#C41E26' };
    }
  };

  const iconConfig = getIcon();

  const getButtonStyle = (button: AlertButton) => {
    if (button.style === 'cancel') return styles.cancelButton;
    if (button.style === 'destructive') return styles.destructiveButton;
    return styles.defaultButton;
  };

  const getButtonTextStyle = (button: AlertButton) => {
    if (button.style === 'cancel') return styles.cancelButtonText;
    if (button.style === 'destructive') return styles.destructiveButtonText;
    return styles.defaultButtonText;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          Icon
          <View style={[styles.iconContainer, { backgroundColor: `${iconConfig.color}15` }]}>
            <Ionicons name={iconConfig.name} size={48} color={iconConfig.color} />
          </View>

          Title
          <Text style={styles.title}>{title}</Text>

          Message
          <Text style={styles.message}>{message}</Text>

          Buttons
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.button, getButtonStyle(button)]}
                onPress={() => {
                  button.onPress?.();
                  onClose();
                }}
              >
                <Text style={[styles.buttonText, getButtonTextStyle(button)]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Helper function to show alerts (similar to Alert.alert)
export const showCustomAlert = (
  title: string,
  message: string,
  buttons?: AlertButton[],
  icon?: 'success' | 'error' | 'warning' | 'info' | 'question'
) => {
  return {
    title,
    message,
    buttons: buttons || [{ text: 'OK', style: 'default' as const }],
    icon,
  };
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  defaultButton: {
    backgroundColor: '#C41E26',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  destructiveButton: {
    backgroundColor: '#C41E26',
  },
  defaultButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
