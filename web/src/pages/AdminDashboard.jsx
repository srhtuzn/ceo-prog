import { useState, useEffect } from "react";
import { Row, Col, Progress, message, FloatButton } from "antd";
import {
  DashboardOutlined,
  SettingOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

// Constants
const API_URL = "http://localhost:3000"; // config/constants dosyanız varsa oradan da alabilirsiniz

// Components (Dosya yollarını kontrol edin!)
import TopKpiCards from "../components/dashboard/TopKpiCards";
import PersonnelApprovalAlert from "../components/dashboard/PersonnelApprovalAlert";
import ProjectProgressSection from "../components/dashboard/ProjectProgressSection";
import TaskSummaryCard from "../components/dashboard/TaskSummaryCard";

// Modals
import SuccessAnalysisModal from "../components/dashboard/modals/SuccessAnalysisModal";
import FinanceDetailModal from "../components/dashboard/modals/FinanceDetailModal";
import RiskJobsModal from "../components/dashboard/modals/RiskJobsModal";
import AttendanceModal from "../components/dashboard/modals/AttendanceModal";
import PersonnelApprovalModal from "../components/dashboard/modals/PersonnelApprovalModal";
import LeaveTodayModal from "../components/dashboard/modals/LeaveTodayModal";
import ProjectDetailModal from "../components/dashboard/modals/ProjectDetailModal";

export default function AdminDashboard() {
  const [veri, setVeri] = useState(null);

  // Modallar
  const [finansModal, setFinansModal] = useState(false);
  const [riskModal, setRiskModal] = useState(false);
  const [izinModal, setIzinModal] = useState(false);
  const [projeModal, setProjeModal] = useState(false);
  const [personelModal, setPersonelModal] = useState(false);
  const [mesaiModal, setMesaiModal] = useState(false);
  const [basariModal, setBasariModal] = useState(false);

  // Detay Verileri
  const [finansDetay, setFinansDetay] = useState([]);
  const [izinDetay, setIzinDetay] = useState([]);
  const [bekleyenPersonel, setBekleyenPersonel] = useState([]);
  const [riskDetay, setRiskDetay] = useState([]);

  // Mesai / Attendance verisi
  const [attendanceData, setAttendanceData] = useState({
    lateArrivals: [],
    absentNoLeave: [],
    overtimeLeaders: [],
    currentlyWorking: [],
    onLeaveToday: [],
    totalStaff: 0,
  });

  const aktifKullanici = JSON.parse(localStorage.getItem("wf_user"));

  // --- YARDIMCI: GÜVENLİ FETCH FONKSİYONU ---
  // Tüm fetch işlemlerini bu fonksiyon üzerinden geçirerek Token ekliyoruz.
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem("wf_token");
    if (!token) return null;

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 401) {
        // Token geçersizse sessizce null dön (Login sayfasına yönlendirme App.jsx'te yapılabilir)
        console.warn("Yetkisiz erişim: Token geçersiz.");
        return null;
      }
      return await res.json();
    } catch (error) {
      console.error("API Hatası:", error);
      return null;
    }
  };

  // İlk yüklemede genel dashboard + mesai analitiği
  useEffect(() => {
    if (aktifKullanici) {
      verileriGetir();
      fetchAttendanceAnalytics();
    }
  }, []);

  // MESAI GÜNCELLEME EVENT'İNİ DİNLE
  useEffect(() => {
    const handler = () => {
      fetchAttendanceAnalytics();
    };
    window.addEventListener("mesaiDegisti", handler);
    return () => window.removeEventListener("mesaiDegisti", handler);
  }, []);

  const verileriGetir = async () => {
    // 1. Özet Veriler
    const data = await authFetch(`${API_URL}/dashboard/ozet`);
    if (data) {
      setVeri(data);
      // Riskli işler detayını al
      if (data.riskliIsler) {
        setRiskDetay(data.riskliIsler);
      }
    }

    // 2. Personel Onay Listesi
    const users = await authFetch(`${API_URL}/ik/kullanicilar`);
    if (Array.isArray(users)) {
      setBekleyenPersonel(users.filter((u) => u.hesap_durumu === "Bekliyor"));
    }
  };

  // MESAİ / ATTENDANCE ANALYTICS
  const fetchAttendanceAnalytics = async () => {
    try {
      // Tüm fetch işlemlerini authFetch ile yapıyoruz
      const [users, todaysRecords, aktifMesaiListesi, izinler] =
        await Promise.all([
          authFetch(`${API_URL}/ik/kullanicilar`),
          authFetch(`${API_URL}/mesai/bugunku?tumu=true`),
          authFetch(`${API_URL}/mesai/bugunku-aktif`),
          authFetch(`${API_URL}/ik/izinler`),
        ]);

      // Eğer herhangi bir veri gelmezse veya array değilse dur
      if (
        !Array.isArray(users) ||
        !Array.isArray(todaysRecords) ||
        !Array.isArray(aktifMesaiListesi)
      ) {
        return;
      }

      const today = dayjs().format("YYYY-MM-DD");

      const onLeaveToday = (izinler || []).filter(
        (i) =>
          i.durum === "Onaylandı" &&
          today >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
          today <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
      );

      const activeStaffCount = users.filter(
        (u) => u.hesap_durumu === "Aktif"
      ).length;

      const lateArrivals = todaysRecords.filter((r) => {
        const start = dayjs(r.baslangic);
        return start.hour() > 9 || (start.hour() === 9 && start.minute() > 15);
      });

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

      // Fazla mesai liderleri (Mock veya Gerçek)
      let overtimeLeaders = [];
      overtimeLeaders = users.slice(0, 5).map((u) => ({
        ad_soyad: u.ad_soyad,
        avatar: u.avatar,
        total_overtime: Math.floor(Math.random() * 10),
        departman: u.departman,
      }));

      setAttendanceData({
        lateArrivals,
        absentNoLeave,
        overtimeLeaders,
        currentlyWorking: aktifMesaiListesi,
        onLeaveToday,
        totalStaff: activeStaffCount,
      });
    } catch (e) {
      console.error("Attendance fetch error", e);
    }
  };

  // --- DETAY ÇEKME FONKSİYONLARI ---

  const finansDetayGoster = async () => {
    const data = await authFetch(`${API_URL}/finans`); // userId gerekmez, backend tokendan bilir
    if (Array.isArray(data)) {
      setFinansDetay(data.filter((d) => d.durum.includes("Bekliyor")));
      setFinansModal(true);
    }
  };

  // İZİN DETAYLARINI GETİRME
  const izinDetayGoster = async () => {
    const data = await authFetch(`${API_URL}/ik/izinler`);
    if (Array.isArray(data)) {
      const bugun = dayjs().format("YYYY-MM-DD");
      const bugunYoklar = data.filter(
        (i) =>
          i.durum.includes("Onaylandı") &&
          bugun >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
          bugun <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
      );
      setIzinDetay(bugunYoklar);
      setIzinModal(true);
    }
  };

  const personelOnayla = async (id, karar) => {
    const res = await authFetch(`${API_URL}/auth/onay/${id}`, {
      method: "PUT",
      body: JSON.stringify({ durum: karar }),
    });

    if (res) {
      message.success(`Personel ${karar} edildi.`);
      verileriGetir(); // Listeyi yenile
      setPersonelModal(false); // Modalı kapat
    }
  };

  const basariDetayGoster = () => {
    setBasariModal(true);
  };

  if (!veri)
    return (
      <div style={{ padding: 50, textAlign: "center" }}>
        <Progress type="circle" status="active" />
      </div>
    );

  const finansDetaylari = Array.isArray(veri.finans)
    ? veri.finans
    : [veri.finans || {}];

  const currentlyWorkingCount = attendanceData.currentlyWorking.length || 0;
  const onLeaveCount = attendanceData.onLeaveToday?.length || 0;
  const ofisteOlmayanlar =
    attendanceData.totalStaff - currentlyWorkingCount - onLeaveCount;

  const dolulukYuzde =
    attendanceData.totalStaff > 0
      ? Math.round((currentlyWorkingCount / attendanceData.totalStaff) * 100)
      : 0;

  const riskliIslerDetay = veri.riskliIsler || [];

  return (
    <div style={{ paddingBottom: 50, paddingTop: 20 }}>
      {/* FLOAT BUTTON */}
      <FloatButton.Group
        shape="square"
        style={{ right: 24 }}
        icon={<DashboardOutlined />}
        trigger="hover"
      >
        <FloatButton
          icon={<ExportOutlined />}
          tooltip={<div>Dashboard'u Dışa Aktar</div>}
        />
        <FloatButton
          icon={<SettingOutlined />}
          tooltip={<div>Dashboard Ayarları</div>}
        />
        <FloatButton.BackTop visibilityHeight={0} />
      </FloatButton.Group>

      {/* 1. ÜST KARTLAR */}
      <TopKpiCards
        veri={veri}
        riskliIslerDetay={riskliIslerDetay}
        attendanceData={attendanceData}
        currentlyWorkingCount={currentlyWorkingCount}
        onLeaveCount={onLeaveCount}
        ofisteOlmayanlar={ofisteOlmayanlar}
        dolulukYuzde={dolulukYuzde}
        onFinansClick={finansDetayGoster}
        onRiskClick={() => setRiskModal(true)}
        onMesaiClick={() => setMesaiModal(true)}
        onBasariClick={basariDetayGoster}
        onIzinClick={izinDetayGoster}
      />

      {/* 2. PERSONEL ONAY UYARISI */}
      {bekleyenPersonel.length > 0 && (
        <PersonnelApprovalAlert
          bekleyenPersonel={bekleyenPersonel}
          onOpenModal={() => setPersonelModal(true)}
        />
      )}

      {/* 3. GRAFİKLER VE DETAYLAR */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col span={16}>
          <ProjectProgressSection
            projeIlerleme={veri.projeIlerleme}
            onOpenProjeModal={() => setProjeModal(true)}
          />
        </Col>

        <Col span={8}>
          <TaskSummaryCard veri={veri} />
        </Col>
      </Row>

      {/* MODALLAR */}
      <SuccessAnalysisModal
        open={basariModal}
        onClose={() => setBasariModal(false)}
        veri={veri}
      />

      <FinanceDetailModal
        open={finansModal}
        onClose={() => setFinansModal(false)}
        finansDetay={finansDetay}
        finansDetaylari={finansDetaylari}
      />

      <RiskJobsModal
        open={riskModal}
        onClose={() => setRiskModal(false)}
        riskliIslerDetay={riskliIslerDetay}
      />

      <AttendanceModal
        open={mesaiModal}
        onClose={() => setMesaiModal(false)}
        attendanceData={attendanceData}
        currentlyWorkingCount={currentlyWorkingCount}
        onLeaveCount={onLeaveCount}
        dolulukYuzde={dolulukYuzde}
      />

      <PersonnelApprovalModal
        open={personelModal}
        onClose={() => setPersonelModal(false)}
        bekleyenPersonel={bekleyenPersonel}
        personelOnayla={personelOnayla}
      />

      <LeaveTodayModal
        open={izinModal}
        onClose={() => setIzinModal(false)}
        izinDetay={izinDetay}
      />

      {/* YENİ EKLENEN PROJE DETAY MODALI */}
      <ProjectDetailModal
        open={projeModal}
        onClose={() => setProjeModal(false)}
        projeIlerleme={veri.projeIlerleme}
      />
    </div>
  );
}
