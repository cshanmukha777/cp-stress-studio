export const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOKEN_KEY = "cp_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

export async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is it running on port 4000?");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  register: (form) => request("/auth/register", { method: "POST", body: form }),
  me: () => request("/auth/me"),
  analyticsCatalog: () => request("/analytics/catalog"),
  problems: (params) => request(`/problems?${new URLSearchParams(params)}`),
  tags: (params = {}) => request(`/tags?${new URLSearchParams(params)}`),
  tag: (id) => request(`/tags/${id}`),
  createTag: (body) => request('/tags', { method: 'POST', body }),
  updateTag: (id, body) => request(`/tags/${id}`, { method: 'PUT', body }),
  deleteTag: (id) => request(`/tags/${id}`, { method: 'DELETE' }),
  tagProblems: (id) => request(`/tags/${id}/problems`),
  problemTags: (problemId) => request(`/problems/${problemId}/tags`),
  replaceProblemTags: (problemId, tagIds) =>
    request(`/problems/${problemId}/tags`, { method: 'POST', body: { tagIds, replace: true } }),
  addProblemTags: (problemId, tagIds) =>
    request(`/problems/${problemId}/tags`, { method: 'POST', body: { tagIds } }),
  removeProblemTag: (problemId, tagId) =>
    request(`/problems/${problemId}/tags/${tagId}`, { method: 'DELETE' }),
  profile: () => request("/profile"),
  updateProfile: (body) => request("/profile", { method: "PUT", body }),
  templates: () => request("/templates"),
  exportTemplate: (slug) => request(`/templates/export/${slug}`, { method: "POST" }),
  importTemplate: (slug) => request(`/templates/import/${slug}`, { method: "POST" }),
};
