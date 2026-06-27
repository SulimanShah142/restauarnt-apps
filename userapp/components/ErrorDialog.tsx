import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';

interface ErrorDialogProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onRetry?: () => void;
  retryText?: string;
}

const ErrorDialog: React.FC<ErrorDialogProps> = ({
  visible,
  title = 'Error',
  message,
  onClose,
  onRetry,
  retryText = 'Try Again'
}) => {
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
            {onRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.buttonText}>{retryText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    width: '85%',
    maxWidth: 300,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    marginBottom: 20,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 5,
  },
  retryButton: {
    flex: 1,
    padding: 10,
    backgroundColor: '#C41E26',
    borderRadius: 4,
    marginLeft: 5,
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});

export default ErrorDialog;