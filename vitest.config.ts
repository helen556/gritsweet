import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // zadovbalo/ — окремий застосунок зі своїми тестами.
    exclude: [...configDefaults.exclude, "zadovbalo/**"],
  },
});
