// AdminApp/components/SimpleAddressInput.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, Alert } from 'react-native';

interface SimpleAddressInputProps {
  onAddressChange: (address: string) => void;
  onLocationSelected: (locationData: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  placeholder?: string;
  label?: string;
  initialValue?: string;
}

export default function AdminAddressSearch({
  onAddressChange,
  onLocationSelected,
  placeholder = "Enter restaurant address...",
  label = "Restaurant Address",
  initialValue = ""
}: SimpleAddressInputProps) {
  const [address, setAddress] = useState(initialValue);

  const handleTextChange = (text: string) => {
    setAddress(text);
    onAddressChange(text); // Notify parent of address change
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        multiline={true}
        numberOfLines={2}
      />
      <Text style={styles.hint}>Enter the full address. Coordinates will be saved when the form is submitted.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%'
  },
  label: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 8 
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    maxHeight: 80,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
  }
});