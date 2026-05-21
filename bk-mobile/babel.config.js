module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(true);

  const baseConfig = {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      'nativewind/babel',
    ],
  };

  if (isTest) {
    // For tests, use babel-preset-expo but without nativewind
    return {
      presets: [
        ['babel-preset-expo'],
        ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
      ],
      plugins: [],
    };
  }

  return baseConfig;
};
