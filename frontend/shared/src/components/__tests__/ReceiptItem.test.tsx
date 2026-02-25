import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReceiptItem } from '@/components/ReceiptItem';
import { ReceiptItemData } from '@/types';
//import { View } from 'react-native';

// Mock the theme hook
jest.mock('@react-navigation/native', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      card: '#F8F8F8',
      text: '#000000',
      border: '#E5E5E5',
      notification: '#FF3B30',
    },
    dark: false,
  }),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Gesture: {
      Pan: () => ({
        activateAfterLongPress: jest.fn().mockReturnThis(),
        onStart: jest.fn().mockReturnThis(),
        onChange: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
        onFinalize: jest.fn().mockReturnThis(),
        runOnJS: jest.fn().mockReturnThis(),
      }),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: View,
  };
});

describe('ReceiptItem', () => {
  const mockItem: ReceiptItemData = {
    id: '1',
    name: 'Pizza',
    price: '12.99',
    userTags: [1, 2],
  };

  const mockOnUpdate = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnRemoveFromUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name and price correctly', () => {
    const { getByDisplayValue } = render(
      <ReceiptItem
        item={mockItem}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onRemoveFromUser={mockOnRemoveFromUser}
      />,
    );

    expect(getByDisplayValue('Pizza')).toBeTruthy();
    expect(getByDisplayValue('12.99')).toBeTruthy();
  });

  it('calls onUpdate when name is changed', () => {
    const { getByDisplayValue } = render(
      <ReceiptItem
        item={mockItem}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onRemoveFromUser={mockOnRemoveFromUser}
      />,
    );

    const nameInput = getByDisplayValue('Pizza');
    fireEvent.changeText(nameInput, 'Burger');

    expect(mockOnUpdate).toHaveBeenCalledWith({ name: 'Burger' });
  });

  it('calls onUpdate when price is changed', () => {
    const { getByDisplayValue } = render(
      <ReceiptItem
        item={mockItem}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onRemoveFromUser={mockOnRemoveFromUser}
      />,
    );

    const priceInput = getByDisplayValue('12.99');
    fireEvent.changeText(priceInput, '15.50');

    expect(mockOnUpdate).toHaveBeenCalledWith({ price: '15.50' });
  });

  it('filters out non-numeric characters from price input', () => {
    const { getByDisplayValue } = render(
      <ReceiptItem
        item={mockItem}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onRemoveFromUser={mockOnRemoveFromUser}
      />,
    );

    const priceInput = getByDisplayValue('12.99');
    fireEvent.changeText(priceInput, 'abc15.50xyz');

    expect(mockOnUpdate).toHaveBeenCalledWith({ price: '15.50' });
  });

  it('calls onDelete when delete button is pressed', () => {
    const { getByLabelText } = render(
      <ReceiptItem
        item={mockItem}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onRemoveFromUser={mockOnRemoveFromUser}
      />,
    );

    const deleteButton = getByLabelText('Delete item');
    fireEvent.press(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('renders user tags for assigned users', () => {
    const { getByText } = render(
      <ReceiptItem
        item={mockItem}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onRemoveFromUser={mockOnRemoveFromUser}
      />,
    );

    // UserTag component should render the user index
    expect(getByText('1')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('handles empty item gracefully', () => {
    const emptyItem: ReceiptItemData = {
      id: '1',
      name: '',
      price: '',
      userTags: [],
    };

    const { getByPlaceholderText } = render(
      <ReceiptItem
        item={emptyItem}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onRemoveFromUser={mockOnRemoveFromUser}
      />,
    );

    expect(getByPlaceholderText('Item name')).toBeTruthy();
    expect(getByPlaceholderText('0.00')).toBeTruthy();
  });
});
