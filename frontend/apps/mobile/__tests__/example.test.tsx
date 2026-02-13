import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { describe, it } from '@jest/globals';

describe('Example', () => {
  it('renders successfully', () => {
    const { getByText } = render(
      <View>
        <Text>Welcome!</Text>
      </View>
    );
    getByText("Welcome!");
  });
});
