import { render, screen } from '@testing-library/react';
import React from 'react';

describe('Example', () => {
  it('renders successfully', () => {
    render(<div>Hello World</div>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
