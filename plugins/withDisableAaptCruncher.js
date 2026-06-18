const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withDisableAaptCruncher(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('cruncherEnabled')) {
      return config;
    }
    config.modResults.contents = config.modResults.contents.replace(
      /^android \{/m,
      'android {\n    aaptOptions {\n        cruncherEnabled false\n    }\n'
    );
    return config;
  });
};
