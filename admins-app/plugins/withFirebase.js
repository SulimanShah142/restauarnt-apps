const { withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config plugin to add Firebase (Google Services) Gradle plugin
 * This is required for google-services.json to work properly on Android
 */
const withFirebase = (config) => {
  // 1. Configure root-level build.gradle (project-level)
  config = withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults;
    if (!buildGradle.contents) {
      console.warn('[withFirebase] build.gradle not found, skipping root-level config');
      return config;
    }

    let contents = buildGradle.contents;

    if (contents.includes('com.google.gms.google-services')) {
      console.log('[withFirebase] Google Services plugin already configured at project level');
      return config;
    }

    console.log('[withFirebase] Adding Google Services plugin to project-level build.gradle');

    const pluginsBlockRegex = /plugins\s*\{([^}]*)\}/s;

    if (pluginsBlockRegex.test(contents)) {
      const isKotlinDSL = contents.includes('id("com.android.application")') ||
                         contents.includes("id('com.android.application')");

      const pluginDeclaration = isKotlinDSL
        ? '\n    id("com.google.gms.google-services") version "4.4.4" apply false'
        : '\n        classpath "com.google.gms:google-services:4.4.4"';

      contents = contents.replace(pluginsBlockRegex, (match, p1) => {
        return `plugins {${p1}${pluginDeclaration}\n}`;
      });
    } else {
      const isKotlinDSL = contents.includes('plugins {');
      if (isKotlinDSL) {
        contents = `plugins {\n  id("com.google.gms.google-services") version "4.4.4" apply false\n}\n\n` + contents;
      } else {
        contents = `buildscript {\n  dependencies {\n    classpath "com.google.gms:google-services:4.4.4"\n  }\n}\n\n` + contents;
      }
    }

    buildGradle.contents = contents;
    return config;
  });

  // 2. Configure app-level build.gradle
  config = withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults;
    if (!buildGradle.contents) {
      console.warn('[withFirebase] app/build.gradle not found, skipping app-level config');
      return config;
    }

    let contents = buildGradle.contents;

    if (contents.includes('com.google.gms.google-services')) {
      console.log('[withFirebase] Google Services plugin already configured at app level');
    } else {
      console.log('[withFirebase] Applying Google Services plugin to app-level build.gradle');

      const pluginsBlockRegex = /plugins\s*\{([^}]*)\}/s;

      if (pluginsBlockRegex.test(contents)) {
        contents = contents.replace(pluginsBlockRegex, (match, p1) => {
          const isKotlinDSL = p1.includes('id(');
          const pluginDeclaration = isKotlinDSL
            ? '\n    id("com.google.gms.google-services")'
            : "\n    apply plugin: 'com.google.gms.google-services'";
          return `plugins {${p1}${pluginDeclaration}\n}`;
        });
      } else {
        contents = "apply plugin: 'com.google.gms.google-services'\n\n" + contents;
      }
    }

    // Add Firebase BoM and FCM dependencies
    if (!contents.includes('firebase-bom')) {
      console.log('[withFirebase] Adding Firebase BoM and FCM dependencies');
      
      // Find dependencies block
      const depsRegex = /dependencies\s*\{([^}]*)\}/s;
      if (depsRegex.test(contents)) {
        contents = contents.replace(depsRegex, (match, p1) => {
          const firebaseDeps = `
    // Firebase BoM
    implementation platform('com.google.firebase:firebase-bom:33.10.0')
    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging'
${p1}`;
          return `dependencies {${firebaseDeps}\n}`;
        });
      }
    }

    buildGradle.contents = contents;
    return config;
  });

  return config;
};

module.exports = withFirebase;
