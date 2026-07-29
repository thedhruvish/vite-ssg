import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import React from "react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider, dehydrate } from "@tanstack/react-query";

interface GlobalWindowPolyfill {
  window?: unknown;
  matchMedia?: (query: string) => MediaQueryList;
}

// Global DOM & Window polyfill for SSG Node/Bun environment
if (typeof window === "undefined") {
  const globalObj = globalThis as unknown as GlobalWindowPolyfill;
  globalObj.window = globalThis;
  if (!globalThis.window.matchMedia) {
    globalThis.window.matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}

import { getPublicRouteTree } from "../src/publicRouteTree";
import { queryClient } from "../src/lib/query-client";
import {
  publicCoursesQueryOptions,
  coursesQueryOptions,
  courseDetailQueryOptions,
  PublicCourse,
} from "../src/lib/api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "..");
const distDir = path.resolve(webDir, "dist");

interface PageConfig {
  url: string;
  title: string;
  prefetch?: () => Promise<void>;
}

async function runPrerender() {
  console.log("🚀 Starting SSG prerendering using live Hono/Neon API...");

  const templatePath = path.join(distDir, "index.html");
  let htmlTemplate: string;
  try {
    htmlTemplate = await fs.readFile(templatePath, "utf-8");
  } catch (err) {
    console.error("❌ Failed to read dist/index.html. Make sure 'vite build' runs first.", err);
    process.exit(1);
  }

  // Preserve the clean unrendered SPA shell template for SPA / non-SSG routes
  const cleanSpaShell = htmlTemplate;

  const serverUrl = process.env.VITE_SERVER_URL || "http://localhost:8787";
  const coursesApiUrl = `${serverUrl}/public/courses`;
  console.log(`🔍 Fetching course list from API: ${coursesApiUrl}`);

  let apiCourses: Array<PublicCourse> = [];
  try {
    const res = await fetch(coursesApiUrl);
    if (res.ok) {
      apiCourses = (await res.json()) as Array<PublicCourse>;
      console.log(`✅ Retrieved ${apiCourses.length} course(s) from API.`);
    } else {
      console.warn(`⚠️ API ${coursesApiUrl} returned status ${res.status}`);
    }
  } catch (err) {
    console.warn(`⚠️ Could not connect to API at ${coursesApiUrl}.`);
  }

  const pages: PageConfig[] = [
    {
      url: "/",
      title: "EduCourse - Master Modern Development",
      prefetch: async () => {
        await queryClient.ensureQueryData(publicCoursesQueryOptions);
      },
    },
    {
      url: "/courses",
      title: "All Courses | EduCourse",
      prefetch: async () => {
        await queryClient.ensureQueryData(coursesQueryOptions);
        await queryClient.ensureQueryData(publicCoursesQueryOptions);
      },
    },
  ];

  // Add dynamic /courses/:id pages returned from Neon DB API
  for (const course of apiCourses) {
    const courseIdStr = course.id.toString();
    pages.push({
      url: `/courses/${courseIdStr}`,
      title: `${course.title} | EduCourse`,
      prefetch: async () => {
        await queryClient.ensureQueryData(courseDetailQueryOptions(courseIdStr));
      },
    });
  }

  const memoryHistory = createMemoryHistory({
    initialEntries: ["/"],
  });

  const router = createRouter({
    routeTree: getPublicRouteTree(),
    history: memoryHistory,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    context: {
      queryClient,
    },
  });

  let count = 0;

  for (const page of pages) {
    // Clear queryClient cache before each page so fresh route data is fetched
    queryClient.clear();

    if (page.prefetch) {
      try {
        await page.prefetch();
      } catch (e: any) {
        console.warn(`[SSG Warning] Prefetch failed for ${page.url}: ${e?.message || e}`);
      }
    }

    memoryHistory.push(page.url);
    await router.load();

    // Preload component chunks for matched routes
    interface PreloadableComponent {
      preload?: () => Promise<unknown>;
    }
    interface PreloadableRouteMatch {
      component?: PreloadableComponent;
      routeComponent?: PreloadableComponent;
      route?: {
        options?: {
          component?: PreloadableComponent;
          lazy?: PreloadableComponent;
        };
      };
    }

    await Promise.all(
      (router.state.matches || []).map(async (rawMatch) => {
        const match = rawMatch as PreloadableRouteMatch;
        const comps = [
          match?.component,
          match?.routeComponent,
          match?.route?.options?.component,
          match?.route?.options?.lazy,
        ];
        for (const comp of comps) {
          if (comp && typeof comp.preload === "function") {
            await comp.preload();
          }
        }
      })
    );

    let renderedContent = renderToString(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(RouterProvider, { router })
      )
    );

    // Extract any <link ...> tags from body HTML so they are moved to <head>
    const extractedLinks: string[] = [];
    renderedContent = renderedContent.replace(/<link\s+[^>]*\/?>/gi, (match) => {
      extractedLinks.push(match);
      return "";
    });

    // Clean out any <title>, <meta> tags, and initial hidden motion inline styles (opacity:0)
    renderedContent = renderedContent
      .replace(/<title>.*?<\/title>/gi, "")
      .replace(/<meta\s+[^>]*>/gi, "")
      .replace(/style="[^"]*opacity:\s*0[^"]*"/gi, "");

    const dehydratedState = dehydrate(queryClient);
    const headAdditions = [
      ...extractedLinks,
      `<script>window.__REACT_QUERY_STATE__ = ${JSON.stringify(dehydratedState)};</script>`,
    ].join("\n");

    // Update <title> tag in <head> template & inject head additions before </head>
    let pageHtml = htmlTemplate
      .replace(/<title>.*?<\/title>/i, `<title>${page.title}</title>`)
      .replace("</head>", `${headAdditions}\n</head>`);

    // Inject rendered markup into <div id="app">...</div>
    pageHtml = pageHtml.replace('<div id="app"></div>', `<div id="app">${renderedContent}</div>`);

    // Determine target output filepath
    const targetFile =
      page.url === "/"
        ? path.join(distDir, "index.html")
        : path.join(distDir, page.url.replace(/^\//, ""), "index.html");

    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, pageHtml, "utf-8");

    if (page.url !== "/") {
      const directHtmlFile = path.join(distDir, `${page.url.replace(/^\//, "")}.html`);
      await fs.mkdir(path.dirname(directHtmlFile), { recursive: true });
      await fs.writeFile(directHtmlFile, pageHtml, "utf-8");
    }

    console.log(`  ✓ Prerendered ${page.url} → ${path.relative(webDir, targetFile)}`);
    count++;
  }

  // Generate clean non-ssg route files and 404/redirect fallbacks containing ONLY <div id="app"></div>
  const nonSsgDir = path.join(distDir, "non-ssg");
  await fs.mkdir(nonSsgDir, { recursive: true });
  await fs.writeFile(path.join(nonSsgDir, "index.html"), cleanSpaShell, "utf-8");
  await fs.writeFile(path.join(distDir, "non-ssg.html"), cleanSpaShell, "utf-8");

  await fs.writeFile(path.join(distDir, "404.html"), cleanSpaShell, "utf-8");
  await fs.writeFile(path.join(distDir, "_redirects"), "/*  /index.html  200\n", "utf-8");
  console.log(`  ✓ Written clean SPA shell with <div id="app"></div> for Non-SSG route & fallback`);

  console.log(`\n🎉 Successfully prerendered ${count} public pages at build time!`);
  process.exit(0);
}

runPrerender().catch((err) => {
  console.error("❌ SSG Prerender script failed:", err);
  process.exit(1);
});
