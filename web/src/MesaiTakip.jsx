import { useState, useEffect, useRef } from "react";
import {
  Card,
  Button,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  message,
  Alert,
  DatePicker,
  Space,
} from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  CalendarOutlined,
  DownloadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as XLSX from "xlsx"; // Excel için

dayjs.extend(duration);

const API_URL = "http://localhost:3000";

export default function MesaiTakip({ aktifKullanici }) {
  const [iceride, setIceride] = useState(false);
  const [gecmis, setGecmis] = useState([]);
  const [baslangicZamani, setBaslangicZamani] = useState(null);
  const [gecenSure, setGecenSure] = useState("00:00:00");
  const [yukleniyor, setYukleniyor] = useState(false);

  // Raporlama State'i
  const [secilenAy, setSecilenAy] = useState(dayjs()); // Varsayılan: Bu ay

  const timerRef = useRef(null);

  const yoneticiMi = ["Genel Müdür", "İnsan Kaynakları", "Yönetim"].includes(
    aktifKullanici?.rol
  );

  // --- 1. BAŞLANGIÇ VE EVENT DİNLEME ---
  useEffect(() => {
    if (!aktifKullanici) return;

    // Sayfa açıldığında ve "mesaiDegisti" eventi tetiklendiğinde çalışır
    const veriGuncelle = () => {
      durumKontrol();
      gecmisCek();
    };

    // İlk yükleme
    veriGuncelle();

    // Global event dinleyicisi (Widget'tan gelen tetiklemeler için)
    const handleMesaiDegisti = (e) => {
      // Sadece ilgili kullanıcı için güncelleme yap
      if (e.detail?.userId && e.detail.userId === aktifKullanici.id) {
        veriGuncelle();
      }
    };

    window.addEventListener("mesaiDegisti", handleMesaiDegisti);

    return () => {
      window.removeEventListener("mesaiDegisti", handleMesaiDegisti);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [aktifKullanici?.id]);

  // --- 2. SAYAÇ MANTIĞI ---
  useEffect(() => {
    if (iceride && baslangicZamani) {
      // Varsa eski sayacı temizle
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        const fark = dayjs().diff(dayjs(baslangicZamani));
        const sure = dayjs.duration(fark);

        const saat = String(Math.floor(sure.asHours())).padStart(2, "0");
        const dakika = String(sure.minutes()).padStart(2, "0");
        const saniye = String(sure.seconds()).padStart(2, "0");

        setGecenSure(`${saat}:${dakika}:${saniye}`);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setGecenSure("00:00:00");
    }
    return () => clearInterval(timerRef.current);
  }, [iceride, baslangicZamani]);

  // --- 3. API İŞLEMLERİ (GÜVENLİ 🔒) ---

  // Yardımcı: Token ile Fetch
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem("wf_token");
    if (!token) {
      message.error("Oturum süresi dolmuş.");
      return null;
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`, // Anahtarı Göster
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      localStorage.removeItem("wf_user");
      localStorage.removeItem("wf_token");
      window.location.reload();
      throw new Error("Yetkisiz erişim");
    }

    return res;
  };

  const durumKontrol = async () => {
    try {
      // URL'den userId'yi kaldırdık, token'dan alacak
      const res = await authFetch(`${API_URL}/mesai/durum`);
      if (!res) return;

      const data = await res.json();
      if (data.iceride) {
        setIceride(true);
        setBaslangicZamani(data.kayit.baslangic);
      } else {
        setIceride(false);
        setBaslangicZamani(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const gecmisCek = async () => {
    try {
      // userId parametresi silindi, sadece yönetici filtresi kaldı
      const url = `${API_URL}/mesai/gecmis?tumu=${yoneticiMi}`;
      const res = await authFetch(url);
      if (!res) return;

      const data = await res.json();
      setGecmis(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const girisYap = async () => {
    setYukleniyor(true);
    try {
      // Body'den userId SİLİNDİ
      const res = await authFetch(`${API_URL}/mesai/giris`, {
        method: "POST",
        body: JSON.stringify({ aciklama: "Web Giriş" }),
      });

      if (res && res.ok) {
        const data = await res.json();
        setBaslangicZamani(data.baslangic);
        setIceride(true);
        gecmisCek();
        message.success("Mesai Başlatıldı!");

        // Global event tetikle (Widget güncellensin diye)
        window.dispatchEvent(
          new CustomEvent("mesaiDegisti", {
            detail: { userId: aktifKullanici.id },
          })
        );
      }
    } catch (e) {
      message.error("Giriş yapılamadı.");
    } finally {
      setYukleniyor(false);
    }
  };

  const cikisYap = async () => {
    setYukleniyor(true);
    try {
      // Body'den userId SİLİNDİ
      const res = await authFetch(`${API_URL}/mesai/cikis`, {
        method: "PUT",
        body: JSON.stringify({}),
      });

      if (res && res.ok) {
        setIceride(false);
        setBaslangicZamani(null);
        gecmisCek();
        message.success("Mesai Bitirildi. İyi dinlenmeler!");

        window.dispatchEvent(
          new CustomEvent("mesaiDegisti", {
            detail: { userId: aktifKullanici.id },
          })
        );
      }
    } catch (e) {
      message.error("Çıkış yapılamadı.");
    } finally {
      setYukleniyor(false);
    }
  };

  const raporIndir = async () => {
    if (!yoneticiMi) return message.warning("Bu işlem için yetkiniz yok.");

    const ayStr = secilenAy.format("YYYY-MM");
    message.loading("Rapor hazırlanıyor...", 1);

    try {
      const res = await authFetch(`${API_URL}/mesai/rapor?ay=${ayStr}`);
      if (!res) return;

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        return message.info("Bu ay için veri bulunamadı.");
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Puantaj");

      XLSX.writeFile(workbook, `Puantaj_Raporu_${ayStr}.xlsx`);
      message.success("Rapor başarıyla indirildi!");
    } catch (error) {
      message.error("Rapor alınırken hata oluştu.");
    }
  };

  // --- TABLO KOLONLARI ---
  const columns = [
    {
      title: "Personel",
      dataIndex: "ad_soyad",
      render: (t) => <b>{t}</b>,
    },
    {
      title: "Tarih",
      dataIndex: "tarih",
      render: (t) => dayjs(t).format("DD.MM.YYYY"),
    },
    {
      title: "Giriş",
      dataIndex: "baslangic",
      render: (t) => <Tag color="blue">{dayjs(t).format("HH:mm")}</Tag>,
    },
    {
      title: "Çıkış",
      dataIndex: "bitis",
      render: (t) =>
        t ? (
          <Tag color="orange">{dayjs(t).format("HH:mm")}</Tag>
        ) : (
          <Tag color="processing" icon={<ClockCircleOutlined spin />}>
            İçeride
          </Tag>
        ),
    },
    {
      title: "Süre",
      dataIndex: "sure_dakika",
      render: (dk) => {
        if (!dk) return "-";
        const s = Math.floor(dk / 60);
        const d = dk % 60;
        return `${s}s ${d}dk`;
      },
    },
    {
      title: "Durum",
      dataIndex: "mesai_turu",
      render: (t) => (
        <Tag color={t === "Fazla Mesai" ? "purple" : "default"}>{t}</Tag>
      ),
    },
  ];

  // Yönetici değilse başkasının ismini görmesine gerek yok (zaten sadece kendi verisi gelir ama yine de gizleyelim)
  const finalColumns = yoneticiMi
    ? columns
    : columns.filter((c) => c.dataIndex !== "ad_soyad");

  return (
    <div>
      {/* ÜST BİLGİ KARTLARI */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card
            bordered={false}
            style={{
              textAlign: "center",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Statistic
              title="Canlı Durum"
              value={iceride ? "Çalışıyor" : "Mesaide Değil"}
              valueStyle={{
                color: iceride ? "#3f8600" : "#cf1322",
                fontWeight: "bold",
              }}
              prefix={
                iceride ? <ClockCircleOutlined spin /> : <CalendarOutlined />
              }
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card bordered={false} style={{ textAlign: "center" }}>
            <Statistic
              title="Bugünkü Çalışma Süresi"
              value={gecenSure}
              valueStyle={{ fontFamily: "monospace", fontSize: "2rem" }}
            />
            <div style={{ marginTop: 15 }}>
              {!iceride ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={girisYap}
                  loading={yukleniyor}
                  style={{
                    backgroundColor: "#52c41a",
                    borderColor: "#52c41a",
                    width: "100%",
                    fontWeight: "bold",
                    height: "50px",
                  }}
                >
                  MESAİYE BAŞLA
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  danger
                  icon={<PauseCircleOutlined />}
                  onClick={cikisYap}
                  loading={yukleniyor}
                  style={{ width: "100%", fontWeight: "bold", height: "50px" }}
                >
                  MESAİYİ BİTİR
                </Button>
              )}
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            bordered={false}
            title="Aylık Rapor & İşlemler"
            extra={<TeamOutlined />}
            style={{ height: "100%" }}
          >
            {yoneticiMi ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 15 }}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  <span style={{ fontSize: 12, color: "#888" }}>
                    Dönem Seçiniz:
                  </span>
                  <Space>
                    <DatePicker
                      picker="month"
                      value={secilenAy}
                      onChange={setSecilenAy}
                      allowClear={false}
                      style={{ width: "100%" }}
                    />
                    <Button
                      type="default"
                      icon={<DownloadOutlined />}
                      onClick={raporIndir}
                    >
                      İndir
                    </Button>
                  </Space>
                </Space>
                <Alert
                  message="Tüm personelin puantaj özeti Excel olarak indirilir."
                  type="info"
                  style={{ fontSize: 11 }}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  justifyContent: "center",
                }}
              >
                <Alert
                  message="Bilgilendirme"
                  description="Giriş çıkışlarınız otomatik olarak İK sistemine işlenmektedir."
                  type="success"
                  showIcon
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* GEÇMİŞ LİSTESİ */}
      <Card
        title={
          <span>
            <HistoryOutlined /> Hareket Kayıtları (
            {yoneticiMi ? "Tüm Personel" : "Şahsi"})
          </span>
        }
      >
        <Table
          dataSource={gecmis}
          columns={finalColumns}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="middle"
          loading={!gecmis}
        />
      </Card>
    </div>
  );
}
