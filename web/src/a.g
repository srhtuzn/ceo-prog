import { useState, useEffect } from "react";
import { message } from "antd";
import dayjs from "dayjs";
import DashboardCharts from "./components/DashboardCharts";
import DashboardModals from "./components/DashboardModals";

const API_URL = "http://localhost:3000";

export default function AdminDashboard() {
  // --- STATE TANIMLARI ---
  const [veri, setVeri] = useState(null);

  // Detay Verileri State'leri
  const [finansDetay, setFinansDetay] = useState([]);
  const [izinDetay, setIzinDetay] = useState([]);
  const [bekleyenPersonel, setBekleyenPersonel] = useState([]);
  const [riskDetay, setRiskDetay] = useState([]);

  // Karmaşık Mesai Verisi State'i
  const [attendanceData, setAttendanceData] = useState({
    lateArrivals: [],
    absentNoLeave: [],
    overtimeLeaders: [],
    currentlyWorking: [],
    onLeaveToday: [],
    totalStaff: 0,
  });

  // Modal Durumlarını Yöneten Tekil State
  const [modals, setModals] = useState({
    finans: false,
    risk: false,
    izin: false,
    proje: false,
    personel: false,
    mesai: false,
    basari: false,
  });

  const aktifKullanici = JSON.parse(localStorage.getItem("wf_user"));

  // --- YARDIMCI: GÜVENLİ FETCH FONKSİYONU ---
  const authFetch = async (url) => {
    const token = localStorage.getItem("wf_token");
    if (!token) return null;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 401) {
        // Token geçersizse null dön (Login sayfasına atma işini App.jsx veya Router yapar)
        return null;
      }
      return await res.json();
    } catch (error) {
      console.error("Veri çekme hatası:", error);
      return null;
    }
  };

  // --- 1. BAŞLANGIÇ VE EVENT DİNLEME ---
  useEffect(() => {
    if (aktifKullanici) {
      verileriGetir();
      fetchAttendanceAnalytics();
    }

    // Global 'mesaiDegisti' olayını dinle (Widget'tan gelen güncelleme için)
    const handler = () => fetchAttendanceAnalytics();
    window.addEventListener("mesaiDegisti", handler);

    return () => window.removeEventListener("mesaiDegisti", handler);
  }, []);

  // --- 2. TEMEL VERİLERİ ÇEKME ---
  const verileriGetir = async () => {
    const data = await authFetch(`${API_URL}/dashboard/ozet`);
    if (data) {
      setVeri(data);
      if (data.riskliIsler) setRiskDetay(data.riskliIsler);
    }

    const users = await authFetch(`${API_URL}/ik/kullanicilar`);
    if (Array.isArray(users)) {
      setBekleyenPersonel(users.filter((u) => u.hesap_durumu === "Bekliyor"));
    }
  };

  // --- 3. DETAYLI MESAİ ANALİZİ ---
  const fetchAttendanceAnalytics = async () => {
    try {
      const [users, todaysRecords, aktifMesaiListesi, izinler] =
        await Promise.all([
          authFetch(`${API_URL}/ik/kullanicilar`),
          authFetch(`${API_URL}/mesai/bugunku?tumu=true`),
          authFetch(`${API_URL}/mesai/bugunku-aktif`),
          authFetch(`${API_URL}/ik/izinler`),
        ]);

      if (
        !Array.isArray(users) ||
        !Array.isArray(todaysRecords) ||
        !Array.isArray(aktifMesaiListesi)
      ) {
        return;
      }

      const today = dayjs().format("YYYY-MM-DD");

      // Bugün izinde olanlar
      const onLeaveToday = (izinler || []).filter(
        (i) =>
          i.durum === "Onaylandı" &&
          today >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
          today <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
      );

      const activeStaffCount = users.filter(
        (u) => u.hesap_durumu === "Aktif"
      ).length;

      // Geç Kalanlar (> 09:15)
      const lateArrivals = todaysRecords.filter((r) => {
        const start = dayjs(r.baslangic);
        return start.hour() > 9 || (start.hour() === 9 && start.minute() > 15);
      });

      // İşe Gelmeyenler
      const clockedInIds = todaysRecords.map((r) => r.kullanici_id);
      const onLeaveIds = onLeaveToday.map((i) => {
        const u = users.find((user) => user.ad_soyad === i.talep_eden);
        return u ? u.id : null;
      });

      const absentNoLeave = users.filter(
        (u) =>
          u.hesap_durumu === "Aktif" &&
          !clockedInIds.includes(u.id) &&
          !onLeaveIds.includes(u.id)
      );

      // Fazla Mesai Liderleri (Geçen Ay)
      const prevMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      let overtimeLeaders = [];
      const overtimeRes = await authFetch(
        `${API_URL}/mesai/rapor?ay=${prevMonth}`
      );

      if (Array.isArray(overtimeRes) && overtimeRes.length > 0) {
        const overtimeMap = {};
        overtimeRes.forEach((rec) => {
          const durum = rec.Durum || rec.mesai_turu;
          const person = rec.Personel || rec.ad_soyad;
          const sureSaat = parseFloat(rec.Sure_Saat) || 0;

          if (durum && durum.includes("Fazla")) {
            if (!overtimeMap[person]) overtimeMap[person] = 0;
            if (sureSaat > 9) overtimeMap[person] += sureSaat - 9;
          }
        });

        overtimeLeaders = Object.entries(overtimeMap)
          .map(([name, hours]) => ({
            ad_soyad: name,
            total_overtime: hours.toFixed(1),
            avatar: users.find((u) => u.ad_soyad === name)?.avatar,
          }))
          .sort((a, b) => b.total_overtime - a.total_overtime)
          .slice(0, 5);
      }

      setAttendanceData({
        lateArrivals,
        absentNoLeave,
        overtimeLeaders,
        currentlyWorking: aktifMesaiListesi,
        onLeaveToday,
        totalStaff: activeStaffCount,
      });
    } catch (e) {
      console.error("Analiz hatası:", e);
    }
  };

  // --- 4. AKSİYONLAR VE MODAL YÖNETİMİ ---

  const handleModalOpen = async (type) => {
    // Finans modalı açılıyorsa veriyi tazele
    if (type === "finans") {
      const data = await authFetch(`${API_URL}/finans`);
      if (Array.isArray(data)) {
        setFinansDetay(data.filter((d) => d.durum.includes("Bekliyor")));
      }
    }

    // İzin modalı açılıyorsa veriyi tazele
    if (type === "izin") {
      const res = await authFetch(`${API_URL}/ik/izinler`);
      if (Array.isArray(res)) {
        const bugun = dayjs().format("YYYY-MM-DD");
        setIzinDetay(
          res.filter(
            (i) =>
              i.durum === "Onaylandı" &&
              bugun >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
              bugun <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
          )
        );
      }
    }

    setModals((prev) => ({ ...prev, [type]: true }));
  };

  const handleModalClose = (type) => {
    setModals((prev) => ({ ...prev, [type]: false }));
  };

  const personelOnayla = (id, karar) => {
    fetch(`${API_URL}/auth/onay/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
      body: JSON.stringify({ durum: karar }),
    }).then(() => {
      message.success(`İşlem başarılı: ${karar}`);
      verileriGetir(); // Listeyi yenile
      handleModalClose("personel");
    });
  };

  const handleExport = () => {
    message.info("Rapor dışa aktarma özelliği yakında eklenecek!");
  };

  const handleSettings = () => {
    message.info("Ayarlar paneli yakında eklenecek!");
  };

  // Eğer veri henüz yüklenmediyse hiçbir şey gösterme (DashboardCharts içinde loading var)
  if (!veri) return null;

  // --- RENDER ---
  return (
    <>
      <DashboardCharts
        veri={veri}
        attendanceData={attendanceData}
        bekleyenPersonel={bekleyenPersonel}
        riskliIslerDetay={riskliIslerDetay}
        finansDetaylari={
          Array.isArray(veri.finans) ? veri.finans : [veri.finans || {}]
        }
        onOpenModal={handleModalOpen}
        onExport={handleExport}
        onSettings={handleSettings}
      />

      <DashboardModals
        modals={modals}
        onClose={handleModalClose}
        data={{
          finansDetay,
          riskDetay,
          bekleyenPersonel,
          attendanceData,
          izinDetay,
          veri,
        }}
        actions={{
          personelOnayla,
        }}
      />
    </>
  );
}
