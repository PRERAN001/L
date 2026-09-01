module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          // Removed unstable_transformProfile to use default, which properly handles private fields
        },
      ],
      "nativewind/babel",
    ],
  };
};