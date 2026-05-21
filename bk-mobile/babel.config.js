module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(true);

  if (isTest) {
    // For tests, just use identity - don't transform anything
    return {
      presets: [],
      plugins: [],
    };
  }

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      'nativewind/babel',
    ],
  };
};
