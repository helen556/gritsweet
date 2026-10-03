import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Рушії сцен (canvas/WebGL, фізика, частинки) свідомо змінюють стан симуляції в ref між кадрами.
    // Правила сумісності з React Compiler тут не застосовні: компілятор для проєкту не ввімкнено,
    // а стан симуляції не бере участі в рендері React. Решта правил хуків лишається.
    files: ["src/components/scenes/**/*.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/assets/**"]),
]);
