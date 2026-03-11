import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

/** Thin wrapper around TextInput that pre-sets keyboardType='decimal-pad'. */
export function DecimalInput(props: TextInputProps) {
  return <TextInput {...props} keyboardType='decimal-pad' />;
}
