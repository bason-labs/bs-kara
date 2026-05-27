// Post-setup for React Native tests
// React Native's setup.js is already loaded in setupFiles
// This file runs after that and can add additional mocks if needed

jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = require('react-native');
  const BottomSheet = ({ children }) => <View>{children}</View>;
  BottomSheet.displayName = 'BottomSheet';
  const BottomSheetView = ({ children, style }) => <View style={style}>{children}</View>;
  BottomSheetView.displayName = 'BottomSheetView';
  return { __esModule: true, default: BottomSheet, BottomSheetView };
});

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style }) => <View style={style}>{children}</View>,
  };
});

// Suppress react-test-renderer deprecation warnings
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('react-test-renderer is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
