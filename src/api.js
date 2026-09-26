let csrf = null;
export function setCsrf(value) {
  csrf = value;
}
export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  let response;
  try {
    response = await fetch('/api' + path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(!isForm && options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...options.headers,
      },
      body: options.body ? (isForm ? options.body : JSON.stringify(options.body)) : undefined,
    });
  } catch {
    throw new Error('Tidak dapat terhubung. Periksa koneksi, lalu coba lagi.');
  }
  const data = await response.json().catch(() => ({ error: 'Respons server tidak dapat dibaca.' }));
  if (!response.ok) {
    const error = new Error(data.error || 'Permintaan tidak berhasil.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function uploadImage(file) {
  const data = new FormData();
  data.append('image', file);
  return api('/uploads', { method: 'POST', body: data });
}
