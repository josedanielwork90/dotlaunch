module.exports = {
  jest: {
    configure: (config) => {
      // axios v1 ships ES modules. CRA 4's Jest transform ignores
      // node_modules by default, so the raw `import` statement reached the
      // runtime and every suite failed at module load with
      // "Cannot use import statement outside a module" - before a single
      // assertion ran. Transforming axios fixes it for every test that
      // pulls in the service layer.
      config.transformIgnorePatterns = ["node_modules/(?!(axios)/)"];

      config.collectCoverageFrom = [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/index.tsx",
        "!src/reportWebVitals.ts",
      ];

      return config;
    },
  },
  style: {
    postcss: {
      plugins: [
        require('tailwindcss')('src/styles/tailwind.config.js'),
        require('autoprefixer'),
      ],
    },
  },
};
