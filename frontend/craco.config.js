const path = require("path");

/** Repository root, one level above this package. */
const repoRoot = path.resolve(__dirname, "..");

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

      // Suites live in the repository-wide `tests/` tree, outside this
      // package. CRA pins `roots` to <rootDir>/src, so Jest would never
      // discover them; widening roots is what makes them visible.
      config.roots = ["<rootDir>/src", path.join(repoRoot, "tests/frontend")];

      // `roots` only tells Jest where to look; `testMatch` decides what
      // counts as a test, and CRA pins it to src/** as well.
      config.testMatch = [
        "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
        "<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}",
        path.join(repoRoot, "tests/frontend/**/*.{spec,test}.{js,jsx,ts,tsx}"),
      ];

      // Node resolves `node_modules` by walking up from the *importing*
      // file, and those suites sit outside this package - so a test that
      // imports a dependency directly (rather than only through `src/`)
      // would not find it. Pinning this package's node_modules as a module
      // path is what lets a suite in tests/frontend import ethers or
      // @testing-library the same way a module in src/ does.
      config.modulePaths = [
        ...(config.modulePaths || []),
        path.join(__dirname, "node_modules"),
      ];

      // Those suites are also outside the babel-jest include path CRA
      // generates, so the .tsx there would arrive untransformed.
      config.transform = {
        ...config.transform,
        "^.+\\.(js|jsx|ts|tsx)$": require.resolve(
          "react-scripts/config/jest/babelTransform.js"
        ),
      };

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
