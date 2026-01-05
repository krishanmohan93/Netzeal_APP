import React from 'react';
import { render } from '@testing-library/react-native';
import CarouselMedia from '../src/components/CarouselMedia';

const sample = [
  { id: 1, url: 'https://example.com/1.jpg', media_type: 'IMAGE' },
  { id: 2, url: 'https://example.com/2.jpg', media_type: 'IMAGE' },
  { id: 3, url: 'https://example.com/3.mp4', media_type: 'VIDEO' }
];

test('renders dots equal to media items', () => {
  const { getAllByTestId } = render(<CarouselMedia mediaItems={sample} />);
  const dots = getAllByTestId('carousel-dot');
  expect(dots.length).toBe(sample.length);
});
