import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function TypingIndicatorComponent() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev === 3 ? 1 : prev + 1));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.dots}>typing {'•'.repeat(dotCount)}</Text>
    </View>
  );
}

export const TypingIndicator = memo(TypingIndicatorComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dots: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
