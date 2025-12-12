const BASE_URL = "http://localhost:3000";

// Token'lı Fetch Fonksiyonu
export const request = async (endpoint, options = {}) => {
  // LocalStorage'dan token'ı al (user objesinin içinde veya ayrı)
  const userStr = localStorage.getItem("wf_user");
  const token = userStr ? JSON.parse(userStr).token : null;

  const headers = {
    // Eğer FormData gönderiyorsan Content-Type'ı otomatik bırakmalı
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Eğer token süresi dolmuşsa (401) otomatik çıkış yaptırabiliriz
  if (response.status === 401) {
    localStorage.removeItem("wf_user");
    window.location.href = "/"; // Giriş sayfasına at
    return Promise.reject("Oturum süresi doldu");
  }

  return response;
};
