module.exports = function (api) {
    api.cache(true);

    const isProduction = process.env.NODE_ENV === 'production';

    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Strip all console.log/warn/error calls in production builds.
            // Has zero effect on development — logs still appear normally.
            ...(isProduction ? [['transform-remove-console', { exclude: [] }]] : []),
        ],
    };
};