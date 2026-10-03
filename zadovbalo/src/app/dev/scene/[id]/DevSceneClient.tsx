"use client";

import dynamic from "next/dynamic";

// Сцени — лише на клієнті (як і в основному потоці): налаштування руху й розмір екрана відомі тільки там.
export const DevSceneClient = dynamic(() => import("./DevScene").then((m) => m.DevScene), { ssr: false });
