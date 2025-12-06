# 🚀 WorkFlow PRO - Kurumsal İş Takip & ERP Sistemi

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)
![Node](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791)
![Socket.io](https://img.shields.io/badge/RealTime-Socket.io-010101)

**WorkFlow PRO**, modern işletmelerin ihtiyaç duyduğu tüm süreçleri tek bir çatı altında toplayan, gerçek zamanlı ve modüler bir ERP (Kurumsal Kaynak Planlama) çözümüdür. Görev yönetiminden finansal onay süreçlerine, İK yönetiminden dosya arşivine kadar geniş bir yelpazede çözüm sunar.

![Ana Ekran Görünümü](https://via.placeholder.com/1000x500?text=WorkFlow+PRO+Dashboard+Screenshot)
*(Buraya Dashboard ekran görüntüsü eklenecek)*

---

## 🌟 Öne Çıkan Özellikler

### 📋 Gelişmiş Görev Yönetimi
* **3 Farklı Görünüm:** Kanban Panosu (Sürükle-Bırak), Liste Görünümü ve Takvim Modu.
* **Detaylı Takip:** Alt görevler, dosya ekleri, önceliklendirme ve etiketleme.
* **Sürükle & Bırak:** `dnd-kit` altyapısı ile görev durumlarını kolayca değiştirin.

### 💬 Real-Time İletişim (Chat)
* **Socket.io Altyapısı:** Sayfa yenilemeden anlık mesajlaşma.
* **Grup & Özel Sohbet:** Departman grupları veya birebir mesajlaşma.
* **Özellikler:** "Yazıyor..." animasyonu, Mavi tik (Görüldü) bilgisi, Dosya paylaşımı.

### 🗂️ Akıllı Dosya Yönetimi (Drive)
* **Otomatik Hiyerarşi:** Görevlere eklenen dosyalar otomatik olarak `Departman > Proje > Görev` klasörlerine düzenlenir.
* **Gelişmiş Arama:** Dosya türüne, tarihe ve isme göre filtreleme.
* **Çöp Kutusu:** Yanlışlıkla silinen dosyalar için geri yükleme ve 30 günlük otomatik temizlik.

### 👥 İnsan Kaynakları (İK) & Organizasyon
* **İnteraktif Organizasyon Şeması:** CSS ile çizilmiş, dinamik hiyerarşi ağacı.
* **İzin Yönetimi:** Kademeli onay mekanizması (Yönetici -> Genel Müdür).
* **Personel Takibi:** İşe alım onayı ve rol yönetimi.

### ⏱️ Personel Devam Kontrol (PDKS)
* **Mesai Widget'ı:** Header üzerinden tek tıkla "Güne Başla / Günü Bitir".
* **Canlı Sayaç:** Anlık çalışma süresi takibi.
* **Raporlama:** Geç kalanlar, fazla mesai yapanlar ve ofis doluluk oranı analizi.

### 💰 Finans & Satın Alma
* **Talep Yönetimi:** Personel satın alma talebi oluşturur.
* **Onay Zinciri:** Tutar limitine göre (Örn: 10.000 TL üstü) otomatik Genel Müdür onayına düşer.

### 📚 Süreç Kütüphanesi (SOP)
* **İnteraktif Rehber:** İş süreçleri adım adım görselleştirilir.
* **Oryantasyon:** Yeni başlayanlar için "Nasıl Yapılır?" rehberleri.

---

## 🛠️ Teknolojiler

Bu proje **PERN Stack** (PostgreSQL, Express, React, Node.js) mimarisi üzerine kurulmuştur.

| Alan | Teknolojiler |
| :--- | :--- |
| **Frontend** | React (Vite), Ant Design, Recharts, Dnd-Kit, Socket.io-Client |
| **Backend** | Node.js, Express.js, Socket.io, Multer |
| **Veritabanı** | PostgreSQL |
| **Güvenlik** | Bcrypt.js (Şifreleme), Environment Variables |

---

## ⚙️ Kurulum ve Çalıştırma

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyin.

### 1. Gereksinimler
* Node.js (v16 veya üzeri)
* PostgreSQL
* Git

### 2. Projeyi Klonlayın
```bash
git clone [https://github.com/kullaniciadi/workflow-pro.git](https://github.com/kullaniciadi/workflow-pro.git)
cd workflow-pro
