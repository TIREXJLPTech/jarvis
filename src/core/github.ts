const API_BASE = 'https://api.github.com';

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GitHub não configurado - falta GITHUB_TOKEN no .env.');
  }
  return token;
}

async function githubFetch<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!resp.ok) {
    throw new Error(`GitHub respondeu ${resp.status} em ${path}`);
  }

  return (await resp.json()) as T;
}

export interface GhRepo {
  full_name: string;
  description: string | null;
  updated_at: string;
  open_issues_count: number;
  private: boolean;
}

export interface GhSearchItem {
  title: string;
  html_url: string;
  repository_url: string;
  number: number;
  updated_at: string;
  user: { login: string };
}

export interface GhSearchResponse {
  total_count: number;
  items: GhSearchItem[];
}

export interface GhCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  html_url: string;
}

export async function listRepos(): Promise<GhRepo[]> {
  return githubFetch<GhRepo[]>('/user/repos?sort=updated&per_page=30&affiliation=owner');
}

async function getUsername(): Promise<string> {
  const user = await githubFetch<{ login: string }>('/user');
  return user.login;
}

export async function searchOpenItems(tipo: 'pr' | 'issue'): Promise<GhSearchResponse> {
  const username = await getUsername();
  const query = encodeURIComponent(`is:${tipo} is:open user:${username}`);
  return githubFetch<GhSearchResponse>(`/search/issues?q=${query}&sort=updated&order=desc&per_page=20`);
}

export async function listRecentCommits(repo: string): Promise<GhCommit[]> {
  return githubFetch<GhCommit[]>(`/repos/${repo}/commits?per_page=10`);
}
