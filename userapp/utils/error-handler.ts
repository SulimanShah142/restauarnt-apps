import { Alert } from 'react-native';

/**
 * Shows an error dialog with the provided message
 * @param title The title of the error dialog
 * @param message The error message to display
 * @param onRetry Optional callback function to execute when user taps retry
 * @param retryText Optional text for the retry button (defaults to "Try Again")
 */
export const showErrorDialog = (
  title: string,
  message: string,
  onRetry?: () => void,
  retryText: string = 'Try Again'
) => {
  const buttons: {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
  }[] = [
    {
      text: 'Close',
      style: 'cancel',
    }
  ];

  if (onRetry) {
    buttons.unshift({
      text: retryText,
      onPress: onRetry
    });
  }

  Alert.alert(
    title,
    message,
    buttons,
    { cancelable: true }
  );
};

/**
 * Logs an error with additional context and optionally shows an error dialog
 * @param error The error object or message
 * @param context Additional context about where the error occurred
 * @param showDialog Whether to show an error dialog (defaults to true)
 * @param onRetry Optional callback function to execute when user taps retry
 * @param retryText Optional text for the retry button (defaults to "Try Again")
 */
export const handleError = (
  error: any,
  context: string,
  showDialog: boolean = true,
  onRetry?: () => void,
  retryText: string = 'Try Again'
) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const fullMessage = `${context} - Error: ${errorMessage}`;
  
  // console.error(fullMessage);
  
  if (showDialog) {
    showErrorDialog(
      'Error',
      errorMessage,
      onRetry,
      retryText
    );
  }
};

/**
 * Logs an info message
 * @param message The message to log
 * @param context Additional context about where the info occurred
 */
export const logInfo = (message: string, context?: string) => {
  const fullMessage = context ? `${context} - Info: ${message}` : `Info: ${message}`;
  // console.log(fullMessage);
};

/**
 * Logs a warning message
 * @param message The warning message to log
 * @param context Additional context about where the warning occurred
 */
export const logWarning = (message: string, context?: string) => {
  const fullMessage = context ? `${context} - Warning: ${message}` : `Warning: ${message}`;
  // console.warn(fullMessage);
};