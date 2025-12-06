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
    aktifKullanici.rol
  );

  // --- DURUM & GEÇMİŞ YÜKLEME + GLOBAL EVENT DİNLEYİCİSİ ---
  useEffect(() => {
    if (!aktifKullanici) return;

    const handleMesaiDegisti = (e) => {
      // Eğer başka kullanıcının event'i ise ignore
      if (e.detail?.userId && e.detail.userId !== aktifKullanici.id) return;
      durumKontrol();
      gecmisCek();
    };

    // İlk yüklemede çek
    durumKontrol();
    gecmisCek();

    // Event dinleyicisi
    window.addEventListener("mesaiDegisti", handleMesaiDegisti);

    return () => {
      window.removeEventListener("mesaiDegisti", handleMesaiDegisti);
      clearInterval(timerRef.current);
    };
  }, [aktifKullanici?.id]);

  // Sayaç
  useEffect(() => {
    if (iceride && baslangicZamani) {
      timerRef.current = setInterval(() => {
        const fark = dayjs().diff(dayjs(baslangicZamani));
        const sure = dayjs.duration(fark);

        // duration.format kullanıyorsan ilgili plugin’i eklediğini varsayıyorum
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

  const durumKontrol = async () => {
    try {
      const res = await fetch(
        `${API_URL}/mesai/durum?userId=${aktifKullanici.id}`
      );
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
      const url = `${API_URL}/mesai/gecmis?userId=${aktifKullanici.id}&tumu=${yoneticiMi}`;
      const res = await fetch(url);
      const data = await res.json();
      setGecmis(data);
    } catch (err) {
      console.error(err);
    }
  };

  const girisYap = async () => {
    setYukleniyor(true);
    const res = await fetch(`${API_URL}/mesai/giris`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: aktifKullanici.id,
        aciklama: "Web giriş",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setBaslangicZamani(data.baslangic);
      setIceride(true);
      gecmisCek();
      message.success("Mesai Başlatıldı!");

      // Diğer componentlere haber ver
      window.dispatchEvent(
        new CustomEvent("mesaiDegisti", {
          detail: { userId: aktifKullanici.id },
        })
      );
    }
    setYukleniyor(false);
  };

  const cikisYap = async () => {
    setYukleniyor(true);
    const res = await fetch(`${API_URL}/mesai/cikis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: aktifKullanici.id }),
    });
    if (res.ok) {
      setIceride(false);
      setBaslangicZamani(null);
      gecmisCek();
      message.success("Mesai Bitirildi. İyi dinlenmeler!");

      // Diğer componentlere haber ver
      window.dispatchEvent(
        new CustomEvent("mesaiDegisti", {
          detail: { userId: aktifKullanici.id },
        })
      );
    }
    setYukleniyor(false);
  };

  // --- EXCEL RAPORU ALMA ---
  const raporIndir = async () => {
    if (!yoneticiMi) return message.warning("Yetkiniz yok");

    const ayStr = secilenAy.format("YYYY-MM");
    message.loading("Rapor hazırlanıyor...", 1);

    try {
      const res = await fetch(`${API_URL}/mesai/rapor?ay=${ayStr}`);
      const data = await res.json();

      if (data.length === 0) return message.info("Bu ay için veri yok.");

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Puantaj");

      XLSX.writeFile(workbook, `Puantaj_Raporu_${ayStr}.xlsx`);
      message.success("Rapor indirildi!");
    } catch (error) {
      message.error("Rapor alınamadı.");
    }
  };

  const columns = [
    { title: "Personel", dataIndex: "ad_soyad", render: (t) => <b>{t}</b> },
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
          <Tag color="processing">İçeride</Tag>
        ),
    },
    {
      title: "Süre",
      dataIndex: "sure_dakika",
      render: (dk) => {
        const s = Math.floor(dk / 60);
        const d = dk % 60;
        return dk > 0 ? `${s}s ${d}dk` : "-";
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
              valueStyle={{ fontFamily: "monospace" }}
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
                  style={{ width: "100%", fontWeight: "bold" }}
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
          >
            {yoneticiMi ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ fontSize: 12, color: "#888" }}>
                  Dönem Seçiniz:
                </div>
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
                <Alert
                  message="Puantaj özeti Excel olarak indirilir."
                  type="info"
                  style={{ fontSize: 11 }}
                />
              </div>
            ) : (
              <Alert
                message="Bilgilendirme"
                description="Giriş çıkışlarınız otomatik olarak IK sistemine işlenmektedir."
                type="success"
                showIcon
              />
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
        />
      </Card>
    </div>
  );
}
