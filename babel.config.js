module.exports = function (api) {
    api.cache(true);

    const isProduction = process.env.NODE_ENV === 'production';

    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Strip console.log in production but preserve error/warn for crash visibility.
            ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
        ],
    };
};