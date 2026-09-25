const jestPreset = require('jest-expo/jest-preset');
const cloneDeep = require('lodash/cloneDeep');

const config = cloneDeep(jestPreset);

// Remove the problematic jest-expo setup file
config.setupFiles = config.setupFiles ? config.setupFiles.filter(
  file => !file.includes('jest-expo/src/preset/setup.js')
) : [];

// Add our own setup
config.setupFilesAfterEnv = [require.resolve('./jest.setup.js')];

// Ensure nativewind is in transformIgnorePatterns
if (!config.transformIgnorePatterns) {
  config.transformIgnorePatterns = [];
}

// Update transformIgnorePatterns to include all needed packages
config.transformIgnorePatterns = [
  "node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-youtube-iframe|lucide-react-native|@gorhom|react-native-draggable-flatlist|react-native-reanimated|nativewind))"
];

module.exports = config;
