import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { $ } from "bun";

const token = process.env.GITHUB_TOKEN ?? "";

const owner = "bun-and-butter";
const githubUrl = new URL("https://github.com");
const apiBaseUrl = new URL("https://api.github.com/");
const baseUrl = new URL(`/${owner}/`, githubUrl).toString();
const excludedRepos = new Set(["website"]);

const target = resolve("./repos");
mkdirSync(target, { recursive: true });

interface GitHubRepo {
	name: string;
	private: boolean;
	default_branch: string;
}

interface RepoToSync {
	name: string;
	defaultBranch: string;
}

const apiHeaders =
	token === ""
		? undefined
		: {
				Authorization: `Bearer ${token}`,
				"X-GitHub-Api-Version": "2022-11-28",
			};

const fetchRepos = async (): Promise<RepoToSync[]> => {
	const repos: RepoToSync[] = [];
	const limit = 50;

	for (let page = 1; ; page += 1) {
		const url = new URL(`orgs/${owner}/repos`, apiBaseUrl);
		url.searchParams.set("page", String(page));
		url.searchParams.set("per_page", String(limit));
		url.searchParams.set("sort", "full_name");
		url.searchParams.set("direction", "asc");
		url.searchParams.set("type", "public");

		const response = await fetch(url, { headers: apiHeaders });
		if (!response.ok) {
			throw new Error(
				`Failed to fetch repositories from ${url}: ${response.status} ${response.statusText}`,
			);
		}

		const pageRepos = (await response.json()) as GitHubRepo[];
		repos.push(
			...pageRepos
				.filter((repo) => !repo.private)
				.filter((repo) => !excludedRepos.has(repo.name))
				.map((repo) => ({
					name: repo.name,
					defaultBranch: repo.default_branch,
				})),
		);

		if (pageRepos.length < limit) {
			break;
		}
	}

	return repos.sort((a, b) => a.name.localeCompare(b.name));
};

const gitClone = async (repo: RepoToSync, path: string) => {
	rmSync(path, { recursive: true, force: true });

	console.log(`cloning ${repo.name}`);
	await $`git clone --branch ${repo.defaultBranch} ${baseUrl}${repo.name}.git ${path}`;
};

const gitSync = async (repo: RepoToSync, path: string) => {
	console.log(`syncing ${repo.name}`);
	await $`git -C ${path} fetch --tags origin`;

	await $`git -C ${path} reset --hard ${`origin/${repo.defaultBranch}`}`;
	await $`git -C ${path} clean -fd`;
};

const repos = await fetchRepos();

console.log(
	`discovered ${repos.length} public repos: ${repos.map((repo) => repo.name).join(", ")}`,
);

for (const repo of repos) {
	const path = join(target, repo.name);
	const stats = statSync(path, { throwIfNoEntry: false });

	if (!stats?.isDirectory() || !existsSync(join(path, ".git"))) {
		await gitClone(repo, path);
		continue;
	}

	try {
		await gitSync(repo, path);
	} catch (error) {
		console.log(`sync failed for ${repo.name}, recloning fresh`);
		console.error(error);

		await gitClone(repo, path);
	}
}
