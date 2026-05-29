const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the entire workspace so Metro picks up changes in bk-shared
config.watchFolders = [workspaceRoot];

// Resolve workspace packages from both project and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Exclude test files from the bundle
config.resolver.blockList = [/.*\.(test|spec)\.[tj]sx?$/];

module.exports = withNativeWind(config, { input: './global.css' });
