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

export function uploadVideo(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const clean = () => signal?.removeEventListener('abort', abort);
    xhr.open('POST', '/api/uploads/video');
    if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);
    xhr.timeout = 5 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      clean();
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error('Respons server tidak dapat dibaca.'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || 'Video gagal diunggah. Coba lagi.'));
    };
    xhr.onerror = () => {
      clean();
      reject(new Error('Koneksi terputus. Pilih video lagi untuk mencoba ulang.'));
    };
    xhr.ontimeout = () => {
      clean();
      reject(new Error('Unggahan terlalu lama. Periksa koneksi atau gunakan video lebih kecil.'));
    };
    xhr.onabort = () => {
      clean();
      reject(new DOMException('Unggahan dibatalkan.', 'AbortError'));
    };
    if (signal?.aborted) {
      reject(new DOMException('Unggahan dibatalkan.', 'AbortError'));
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    const data = new FormData();
    data.append('video', file);
    xhr.send(data);
  });
}
