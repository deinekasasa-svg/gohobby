// Metro-конфиг с правками под Firebase JS SDK (v9+/модульный).
// Без этих двух строк Metro в новых RN/Expo падает на импортах firebase
// ("Component auth has not been registered yet" / unable to resolve .cjs).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
