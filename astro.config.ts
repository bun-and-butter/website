import sitemap from "@astrojs/sitemap";
import playformCompress from "@playform/compress";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://bun-and-butter.dev",
	output: "static",

	vite: {
		plugins: [tailwindcss()],
	},

	integrations: [sitemap(), playformCompress()],
});
