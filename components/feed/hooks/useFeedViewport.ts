import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export function useFeedViewport() {
  const { width, height } = useWindowDimensions();

  return useMemo(
    () => ({
      screenWidth: width,
      screenHeight: height,
      cardHeight: height,
    }),
    [height, width]
  );
}
