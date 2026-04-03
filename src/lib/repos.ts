import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export interface Commit {
	hash: string;
	shortHash: string;
	date: string;
	subject: string;
}

export interface Repo {
	id: string;
	description?: string;
	keywords?: string[];
	license?: string;
	readme: string;
	examples: { path: string; content: string }[];
	tags: string[];
	latestCommit: Commit | null;
}

const slugify = (value: string) =>
	value
		.replaceAll("\\", "/")
		.replaceAll(/[^a-zA-Z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.toLowerCase();

const git = (repoPath: string, args: string[]) => {
	try {
		return execFileSync("git", ["-C", repoPath, ...args], {
			encoding: "utf8",
		}).trim();
	} catch {
		return "";
	}
};

// Resolve from the project root so SSR/prerender builds don't follow the
// compiled chunk location under dist/.
const repoBasePath = resolve(process.cwd(), "repos");

export const getExampleAnchorId = (filepath: string) => {
	const normalizedPath = filepath.replaceAll("\\", "/");
	const slug = slugify(normalizedPath) || "file";
	const hash = createHash("sha1")
		.update(normalizedPath)
		.digest("hex")
		.slice(0, 8);

	return `example-${slug}-${hash}`;
};

const cleanReadme = (content: string) => {
	return content
		.replace(/^# .+\n+/m, "")
		.replace(/^<img\s+src="doc\/logo\.webp"[^>]*>\n*/m, "")
		.replaceAll(
			/\]\((?:\.\/)?examples\/([^)]+)\)/g,
			(_, filepath: string) => `](#${getExampleAnchorId(filepath)})`,
		)
		.trim();
};

function parseRepo(id: string): Repo {
	const repoPath = join(repoBasePath, id);

	const packageJsonPath = join(repoPath, "package.json");
	const packageJsonStats = statSync(packageJsonPath, { throwIfNoEntry: false });
	if (!packageJsonStats?.isFile()) {
		throw new Error(`No package.json found "${packageJsonPath}"`);
	}
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

	const imgPath = join(repoPath, "doc", "logo.webp");
	const imgStats = statSync(imgPath, { throwIfNoEntry: false });
	if (!imgStats?.isFile()) {
		throw new Error(`No logo found "${imgPath}"`);
	}

	const readmePath = join(repoPath, "README.md");
	const readmeStats = statSync(readmePath, { throwIfNoEntry: false });
	if (!readmeStats?.isFile()) {
		throw new Error(`No README.md found "${readmePath}"`);
	}
	const readme = cleanReadme(readFileSync(readmePath, "utf-8"));

	const examplesPath = join(repoPath, "examples");
	const examples = readdirSync(examplesPath)
		.map((file) => join(examplesPath, file))
		.map((path) => ({
			path,
			content: readFileSync(path, "utf-8")
				.replace(/^# .+\n+/m, "")
				.replace(/^<img\s+src="doc\/logo\.webp"[^>]*>\n*/m, "")
				.trim(),
		}));

	const tagsOutput = git(repoPath, ["tag", "--sort=-creatordate"]);
	const tags =
		tagsOutput === ""
			? []
			: tagsOutput
					.split("\n")
					.filter((tag) => tag !== "" && tag.startsWith("v"));

	const latestCommitOutput = git(repoPath, [
		"log",
		"-1",
		"--format=%H%n%h%n%cs%n%s",
	]);

	const latestCommit =
		latestCommitOutput === ""
			? null
			: (() => {
					const [hash = "", shortHash = "", date = "", subject = ""] =
						latestCommitOutput.split("\n");

					return { hash, shortHash, date, subject };
				})();

	return {
		id,
		description: packageJson.description,
		keywords: packageJson.keywords,
		license: packageJson.license,
		readme,
		examples,
		tags,
		latestCommit,
	};
}

export const parseRepose = (): Repo[] =>
	readdirSync(repoBasePath).map(parseRepo);
